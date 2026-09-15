// Calm — OMP port of firstmate's fm-calm extension.
// Source: https://github.com/kunchenguid/firstmate/blob/main/.pi/extensions/fm-calm.ts
//
// What Calm does (ported):
//   - Hides all tool-call/tool-result rows so the transcript reads as agent prose.
//   - Hides mid-turn assistant "working notes" (text blocks on messages that ended
//     in toolUse), keeping only the genuine final reply.
//   - Shows a small animated boat widget while the agent works.
//   - /calm toggles; ON by default; preference persists.
//
// OMP adaptation notes:
//   - fm-calm hides tool rows by re-registering wrapped copies of Pi's built-in
//     tools whose renderers return empty output. OMP instead exposes the native
//     mechanism used by its own Ctrl+Shift+O toggle: TranscriptContainer
//     .setToolActivityVisible() plus the display.hideToolActivity setting. This
//     port drives that native path, so every tool row (built-in, MCP, extension)
//     is covered and no tool definitions are replaced.
//   - The live InteractiveMode context is reached through the TUI component tree:
//     the status container stores it on a public `.mode` field. A zero-height
//     probe widget below the editor captures the TUI instance at session_start.
//   - fm-calm's operational-input classifier and synthetic-user layout depend on
//     firstmate's supervisor shell script and are not ported.
//   - OMP has no setWorkingVisible(), so the stock "Working…" row stays visible
//     alongside the boat.
//   - The thinking toggle (hideThinkingBlock / Ctrl+T) is untouched: OMP never
//     sets hiddenThinkingLabel, so the thinking half of the assistant adapter is
//     inert by construction.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Calm also suppresses the per-turn stat rows (duration / token counts / cost),
// which OMP renders only when display.showTokenUsage is set (display.showTurnTime
// adds the wall-clock time inside that same row). The user's pre-calm values are
// saved to a sidecar file so toggling calm off restores them exactly, and so a
// session that starts with calm already on can still recover the originals.
const CALM_STATS_PREF = join(
  dirname(fileURLToPath(import.meta.url)),
  ".calm-stats-pref.json",
);
const CALM_STAT_KEYS = ["display.showTokenUsage", "display.showTurnTime"];

function calmReadSavedStats() {
  try {
    return JSON.parse(readFileSync(CALM_STATS_PREF, "utf8"));
  } catch {
    return null;
  }
}

function calmSuppressStats(s) {
  if (!s) return;
  if (!existsSync(CALM_STATS_PREF)) {
    const saved = {};
    for (const key of CALM_STAT_KEYS) saved[key] = s.get(key);
    try {
      writeFileSync(CALM_STATS_PREF, JSON.stringify(saved));
    } catch {
      // Best-effort: suppression still applies for this session.
    }
  }
  for (const key of CALM_STAT_KEYS) s.set(key, false);
}

function calmRestoreStats(s) {
  if (!s) return;
  const saved = calmReadSavedStats();
  if (!saved) return;
  for (const key of CALM_STAT_KEYS) {
    if (saved[key] !== undefined) s.set(key, saved[key]);
  }
  try {
    writeFileSync(CALM_STATS_PREF, JSON.stringify({}));
  } catch {
    // Best-effort.
  }
}

// ---------------------------------------------------------------------------
// Ship animation (ported verbatim from lib/fm-calm-working-ship.ts)
// ---------------------------------------------------------------------------

const HULL = "\\__/";
const SAIL_RIGHT = "<|";
const SAIL_LEFT = "|>";
const SAIL_OFFSET = 1;
const HULL_WIDTH = HULL.length;
const SAIL_WIDTH = SAIL_RIGHT.length;
const WAVE_CYCLE = ["~", "~", "-", "~"];
const ESC = String.fromCharCode(27);
const BLUE = `${ESC}[34m`;
const YELLOW = `${ESC}[33m`;
const RESET = `${ESC}[39m`;
const SHIP_WIDGET_KEY = "calm-working-ship";
const SHIP_TICK_MS = 220;
const SHIP_TICKS_PER_MOVE = 4;

function trackSpan(width) {
  if (width >= HULL_WIDTH) return width - HULL_WIDTH;
  if (width >= SAIL_WIDTH) return width - SAIL_WIDTH;
  return 0;
}

function createCalmWorkingShipAnimation() {
  let position = 0;
  let direction = 1;
  let span = 0;
  let phase = 0;
  let ticks = 0;
  let renderedPosition = position;
  let renderedDirection = direction;
  let renderedSpan = span;
  let renderedPhase = phase;
  let renderedTicks = ticks;

  const settleDirectionAtEdges = () => {
    if (span <= 0) return;
    if (position >= span) direction = -1;
    else if (position <= 0) direction = 1;
  };

  const applyWidth = (width) => {
    if (width <= 0) {
      span = 0;
      position = 0;
      return;
    }
    span = trackSpan(width);
    position = Math.min(position, span);
    settleDirectionAtEdges();
  };

  const commitRenderedState = () => {
    renderedPosition = position;
    renderedDirection = direction;
    renderedSpan = span;
    renderedPhase = phase;
    renderedTicks = ticks;
  };

  const restoreLastRenderedState = () => {
    position = renderedPosition;
    direction = renderedDirection;
    span = renderedSpan;
    phase = renderedPhase;
    ticks = renderedTicks;
  };

  const water = (from, count) => {
    if (count <= 0) return "";
    let cells = "";
    for (let column = from; column < from + count; column += 1) {
      cells += WAVE_CYCLE[(column + phase) % WAVE_CYCLE.length];
    }
    return `${BLUE}${cells}${RESET}`;
  };

  const boat = (text) => `${YELLOW}${text}${RESET}`;

  return {
    position: () => position,
    direction: () => direction,
    waterPhase: () => phase,
    restoreLastRendered: restoreLastRenderedState,
    reset() {
      position = 0;
      direction = 1;
      span = 0;
      phase = 0;
      ticks = 0;
      commitRenderedState();
    },
    clampToWidth(width) {
      applyWidth(width);
    },
    tick() {
      ticks += 1;
      phase = (phase + 1) % WAVE_CYCLE.length;
      if (ticks % SHIP_TICKS_PER_MOVE !== 0) return;
      if (span <= 0) {
        position = 0;
        return;
      }
      position = Math.min(span, Math.max(0, position + direction));
      settleDirectionAtEdges();
    },
    render(width) {
      if (width <= 0) return [];
      applyWidth(width);
      const sail = direction >= 0 ? SAIL_RIGHT : SAIL_LEFT;
      let frame;
      if (width < SAIL_WIDTH) {
        frame = [water(0, width)];
      } else if (width < HULL_WIDTH) {
        frame = [
          water(0, position) +
            boat(sail) +
            water(position + SAIL_WIDTH, width - position - SAIL_WIDTH),
        ];
      } else {
        frame = [
          " ".repeat(position + SAIL_OFFSET) + boat(sail),
          water(0, position) +
            boat(HULL) +
            water(position + HULL_WIDTH, width - position - HULL_WIDTH),
        ];
      }
      commitRenderedState();
      return frame;
    },
  };
}

function createCalmWorkingShipWidget(tui, animation) {
  let disposed = false;
  const timer = setInterval(() => {
    if (disposed) return;
    animation.tick();
    tui.requestRender();
  }, SHIP_TICK_MS);
  timer.unref?.();
  return {
    render: (width) => (disposed ? [] : [...animation.render(width), ""]),
    invalidate: () => {},
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearInterval(timer);
      animation.restoreLastRendered();
    },
  };
}

// ---------------------------------------------------------------------------
// Assistant layout adapter (ported from lib/fm-calm-assistant-layout.ts)
// Hides mid-turn working notes while calm. The thinking half is inert in OMP
// (hiddenThinkingLabel is never ""), which keeps Ctrl+T independent.
// ---------------------------------------------------------------------------

function isMidTurnAssistantMessage(message) {
  if (message.stopReason === "toolUse") return true;
  return (
    message.stopReason === "length" &&
    Array.isArray(message.content) &&
    message.content.some((block) => block.type === "toolCall")
  );
}

const CALM_ASSISTANT_LAYOUT_PATCH = Symbol.for("omp:calm-assistant-layout:v1");

function installCalmAssistantLayout(pi, hidesWorkingNote) {
  const registry = globalThis;
  const installed = registry[CALM_ASSISTANT_LAYOUT_PATCH];
  if (installed) {
    installed.hidesWorkingNote = hidesWorkingNote;
    return;
  }
  const patch = { hidesWorkingNote };
  const AssistantMessageComponent = pi.pi?.AssistantMessageComponent;
  if (typeof AssistantMessageComponent !== "function") {
    throw new Error("Calm requires AssistantMessageComponent");
  }
  const originalUpdateContent = AssistantMessageComponent.prototype.updateContent;
  if (typeof originalUpdateContent !== "function") {
    throw new Error("Calm requires AssistantMessageComponent.updateContent");
  }
  AssistantMessageComponent.prototype.updateContent = function (message, ...rest) {
    const state = this;
    const hideThinking =
      state.hiddenThinkingLabel === "" &&
      state.hideThinkingBlock === true &&
      hidesWorkingNote();
    const hideWorkingNote =
      hidesWorkingNote() && isMidTurnAssistantMessage(message);
    const presentationMessage =
      hideThinking || hideWorkingNote
        ? {
            ...message,
            content: message.content.filter(
              (block) =>
                !(hideThinking && block.type === "thinking") &&
                !(hideWorkingNote && block.type === "text"),
            ),
          }
        : message;
    originalUpdateContent.call(this, presentationMessage, ...rest);
    if (presentationMessage !== message) state.lastMessage = message;
  };
  registry[CALM_ASSISTANT_LAYOUT_PATCH] = patch;
}

// ---------------------------------------------------------------------------
// Extension entry
// ---------------------------------------------------------------------------

export default function (pi) {
  let calm = false; // mirrors display.hideToolActivity
  let agentRunActive = false;
  let tui = null; // captured from the probe widget factory
  let mode = null; // InteractiveMode ctx, found via tui tree
  let ui = null; // ExtensionUIContext, captured at session_start
  let listenerInstalled = false;
  let exportRestoreTimer = null;

  const shipAnimation = createCalmWorkingShipAnimation();

  const settings = () => pi.pi?.settings;

  function findMode() {
    if (mode) return mode;
    if (!tui || !Array.isArray(tui.children)) return null;
    for (const child of tui.children) {
      const m = child?.mode;
      if (m && m.chatContainer && m.ui) {
        mode = m;
        return mode;
      }
    }
    return null;
  }

  // Replicates InteractiveMode.toggleToolActivityVisibility's component work,
  // minus the settings write (callers own the setting).
  function applyToolVisibility() {
    const m = findMode();
    if (!m) return;
    const hidden = calm;
    m.hideToolActivity = hidden;
    if (!hidden) m.toolOutputExpanded = false;
    const Ka = pi.pi?.ToolExecutionComponent;
    const Cu = pi.pi?.ReadToolGroupComponent;
    const Vu = pi.pi?.AssistantMessageComponent;
    for (const child of m.chatContainer.children) {
      if (!hidden && ((Ka && child instanceof Ka) || (Cu && child instanceof Cu))) {
        child.setExpanded?.(false);
      } else if (Vu && child instanceof Vu) {
        child.setToolResultImagesVisible?.(!hidden);
      }
    }
    m.chatContainer.setToolActivityVisible?.(!hidden);
    if (hidden) m.ui.clearInlineImages?.();
    m.ui.resetDisplay?.();
  }

  // Re-render the transcript so working notes reappear (calm off) or collapse
  // (calm on) in already-rendered assistant components.
  function rebuildTranscript() {
    const m = findMode();
    if (!m || m.initialChatRendered !== true) return;
    try {
      m.rebuildChatFromMessages?.();
    } catch {
      // Rebuild is best-effort; new messages still get the right layout.
    }
  }

  function applyWorkingPresentation(ui) {
    if (!ui) return;
    if (agentRunActive && calm) {
      ui.setWidget(SHIP_WIDGET_KEY, (t) => createCalmWorkingShipWidget(t, shipAnimation));
    } else {
      ui.setWidget(SHIP_WIDGET_KEY, undefined);
    }
  }

  function ensureSettingsListener() {
    if (listenerInstalled) return;
    const s = settings();
    if (!s || typeof s.onEffectiveChange !== "function") return;
    listenerInstalled = true;
    s.onEffectiveChange((path, value) => {
      if (path !== "display.hideToolActivity") return;
      const next = value === true;
      if (next === calm) return;
      calm = next;
      if (calm) calmSuppressStats(s);
      else calmRestoreStats(s);
      applyToolVisibility();
      rebuildTranscript();
      applyWorkingPresentation(ui);
    });
  }

  function setCalm(next, ui) {
    const s = settings();
    if (s) s.set("display.hideToolActivity", next);
    calm = next;
    if (calm) calmSuppressStats(s);
    else calmRestoreStats(s);
    applyToolVisibility();
    rebuildTranscript();
    applyWorkingPresentation(ui);
  }

  // The probe widget is invisible (renders nothing) and sits below the editor so
  // it never adds the spacer row above-editor widgets get. Its only job is to
  // hand us the live TUI object at session_start.
  function installProbe(ui) {
    ui.setWidget(
      "calm-probe",
      (t) => {
        tui = t;
        findMode();
        return { render: () => [], invalidate: () => {}, dispose: () => {} };
      },
      { placement: "belowEditor" },
    );
  }

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    ui = ctx.ui;
    installProbe(ctx.ui);
    ensureSettingsListener();
    const s = settings();
    if (s) {
      // Default ON: only when the user has never touched the setting.
      if (!s.isConfigured("display.hideToolActivity")) {
        s.set("display.hideToolActivity", true);
      }
      calm = s.get("display.hideToolActivity") === true;
      if (calm) calmSuppressStats(s);
    }
    applyToolVisibility();
    try {
      installCalmAssistantLayout(pi, () => calm);
    } catch (error) {
      ctx.ui.notify(`Calm: assistant layout unavailable (${error})`, "warning");
    }
  });

  pi.on("agent_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    agentRunActive = true;
    applyWorkingPresentation(ctx.ui);
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    agentRunActive = false;
    applyWorkingPresentation(ctx.ui);
  });

  pi.on("session_shutdown", async () => {
    agentRunActive = false;
    clearTimeout(exportRestoreTimer);
  });

  pi.registerCommand("calm", {
    description: "Toggle Calm: hide tool activity and working notes",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      const next = !calm;
      setCalm(next, ctx.ui);
      const m = findMode();
      if (m?.showStatus) {
        m.showStatus(`Tool activity: ${next ? "hidden" : "visible"}`);
      } else {
        ctx.ui.notify(`Calm ${next ? "on" : "off"} — tool activity ${next ? "hidden" : "visible"}`);
      }
    },
  });

  // Stock-export escape hatch (ported): submitting /export or /share while calm
  // briefly restores tool rows so the rendered export includes them, then
  // re-hides on the next tick. OMP submits the editor on carriage return.
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI || !ctx.ui.onTerminalInput) return;
    ctx.ui.onTerminalInput((data) => {
      if (!calm || data !== "\r") return;
      const text = ctx.ui.getEditorText?.().trim() ?? "";
      if (!text.startsWith("/export") && !text.startsWith("/share")) return;
      const m = findMode();
      if (!m) return;
      m.chatContainer.setToolActivityVisible?.(true);
      for (const child of m.chatContainer.children) {
        const Vu = pi.pi?.AssistantMessageComponent;
        if (Vu && child instanceof Vu) child.setToolResultImagesVisible?.(true);
      }
      m.ui.resetDisplay?.();
      clearTimeout(exportRestoreTimer);
      exportRestoreTimer = setTimeout(() => {
        exportRestoreTimer = null;
        if (!calm) return;
        applyToolVisibility();
      }, 0);
    });
  });
}
