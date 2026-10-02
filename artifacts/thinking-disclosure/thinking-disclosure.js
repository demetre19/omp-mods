// thinking-disclosure.js — keep a Ctrl+T disclosure row when thinking is hidden.
//
// Drop-in OMP extension port of the thinking-disclosure source patch
// (omp-18.0.11-65f79e7.patch in this directory). The binary patch is still the
// only way to get the feature into exports/snapshots, but for the interactive
// transcript an extension can reproduce it:
//
//   - With `hideThinkingBlock: true` (Ctrl+T hidden), each assistant message
//     that contains reasoning gains one muted row:
//         ▸ Thinking · Ctrl+T to expand
//     Ctrl+T flips hideThinkingBlock globally and the stock renderer shows the
//     reasoning inline; the row disappears on the next render because the
//     hidden state is off.
//   - While a thought is still streaming, the stock animated "Thinking…"
//     pulse keeps showing; the disclosure row sits under it.
//
// How it works:
//   - AssistantMessageComponent.prototype.setHideThinkingBlock is wrapped to
//     record the hidden flag on the instance (the real field is private), then
//     delegates to the original.
//   - prototype.updateContent is wrapped to record whether the message carries
//     any thinking content (calm.js may also filter it; we run first regardless
//     of extension order because we capture state before delegating).
//   - prototype.render is wrapped: after the stock render, if the component is
//     hidden AND the message had thinking AND the disclosure setting is on, one
//     label row is appended to the returned rows. No component internals are
//     touched — #contentContainer stays private.
//   - Fallback for components constructed before the wrapper (or streams that
//     bypass setHideThinkingBlock): the live InteractiveMode's public
//     `hideThinkingBlock` flag, reached through the TUI tree via a zero-height
//     probe widget (same technique as calm.js).
//   - Persistence: `thinkingDisclosure` boolean in OMP's own settings store via
//     the reactive-registry write path ported from calm.js (duck-typed Setting
//     descriptors + writeValue; legacy settings.set fallback for pre-18.3).
//     On-by-default is NOT assumed: defaults true after install, toggleable
//     with /thinking-disclosure.
//
// Compatibility: built for OMP 18.4.x. Requires pi.pi.AssistantMessageComponent
// with updateContent/render/setHideThinkingBlock on the prototype. If upstream
// renames them the extension warns at session_start and does nothing. If OMP
// ships thinkingDisclosure natively, delete this file — running both would
// double-render the row.
//
// Install: copy this file to ~/.omp/agent/extensions/ and restart OMP.
//          Installing alone hides thinking: at every session start it writes
//          hideThinkingBlock=true, and hidden reasoning leaves NO trace —
//          the `▸ Thinking · Ctrl+T to expand` row is opt-in only.
//          /thinking-disclosure opts into the row and persists via the
//          settings store; Ctrl+T always expands regardless.
//          The persisted off state applies on every surface — including
//          UI-less ones like `omp render` — because the row check re-reads
//          the setting instead of relying on module-init state.

const TD_PATCH = Symbol.for("omp:thinking-disclosure:v1");
const TD_SETTING_ID = "thinkingDisclosure";
const TD_ON = Symbol.for("omp:thinking-disclosure:on");
const TD_HIDE = Symbol.for("omp:thinking-disclosure:hide");
const TD_HAS_THINKING = Symbol.for("omp:thinking-disclosure:has-thinking");

const TD_LABEL_EXPAND = "\x1b[2m▸ Thinking · Ctrl+T to expand\x1b[0m";
const TD_LABEL_COLLAPSE = "\x1b[2m▾ Thinking · Ctrl+T to collapse\x1b[0m";

// --- settings persistence (ported from calm.js) ------------------------------
// OMP 18.3+ Settings registry duck-types Setting objects; only .id, .segments,
// .slot, .definition, .get(s), .assertWritable(v) are consumed. Fake slots live
// far above the real range so they never collide with real Setting slots.
let tdFakeSlot = 0x7fff1000;
const tdSettingsCache = new Map();

function tdSetting(id, def) {
  let st = tdSettingsCache.get(id);
  if (st) return st;
  st = {
    id,
    segments: id.split("."),
    slot: tdFakeSlot++,
    definition: { id, type: "boolean", default: def },
    get(s) {
      const v = s.rawValue(st);
      return v === undefined ? def : v;
    },
    assertWritable(v) {
      if (typeof v !== "boolean") throw new TypeError(`${id} expects a boolean`);
      return v;
    },
    set(s, v) {
      s.writeValue(st, v, "global");
    },
  };
  tdSettingsCache.set(id, st);
  return st;
}

function tdSupportsNewApi(s) {
  return (
    s &&
    typeof s.rawValue === "function" &&
    typeof s.writeValue === "function" &&
    typeof s.get !== "function"
  );
}

function tdGet(s, id, def = false) {
  if (!s) return def;
  if (tdSupportsNewApi(s)) {
    try {
      return tdSetting(id, def).get(s) === true;
    } catch {
      return def;
    }
  }
  if (typeof s.get === "function") {
    try {
      const v = s.get(id);
      return v === undefined ? def : v === true;
    } catch {
      return def;
    }
  }
  return def;
}

function tdSet(s, id, v) {
  if (!s) return false;
  if (tdSupportsNewApi(s)) {
    try {
      tdSetting(id, false).set(s, v);
      return true;
    } catch {
      return false;
    }
  }
  if (typeof s.set === "function") {
    try {
      s.set(id, v);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function tdCommit(s) {
  if (!s || typeof s.flush !== "function") return;
  Promise.resolve(s.flush())
    .then(() => s.reloadFromDisk?.())
    .catch(() => {});
}
// -----------------------------------------------------------------------------

function messageHasThinking(message) {
  const content = message?.content;
  if (!Array.isArray(content)) return false;
  for (const block of content) {
    if (block && block.type === "thinking") return true;
  }
  return false;
}

function installDisclosurePatch(pi, hooks) {
  const registry = globalThis;
  const existing = registry[TD_PATCH];
  if (existing) {
    // Re-load / re-entry: refresh hooks without double-wrapping the prototype.
    existing.hooks = hooks;
    return;
  }
  const AssistantMessageComponent = pi.pi?.AssistantMessageComponent;
  if (typeof AssistantMessageComponent !== "function") {
    throw new Error("AssistantMessageComponent is not exposed on pi.pi");
  }
  const proto = AssistantMessageComponent.prototype;
  const originalUpdateContent = proto.updateContent;
  const originalRender = proto.render;
  const originalSetHide = proto.setHideThinkingBlock;
  if (typeof originalUpdateContent !== "function" || typeof originalRender !== "function") {
    throw new Error("AssistantMessageComponent lacks updateContent/render");
  }

  const shared = { hooks };

  if (typeof originalSetHide === "function") {
    proto.setHideThinkingBlock = function (hide, ...rest) {
      this[TD_HIDE] = hide === true;
      return originalSetHide.call(this, hide, ...rest);
    };
  }

  proto.updateContent = function (message, ...rest) {
    if (messageHasThinking(message)) this[TD_HAS_THINKING] = true;
    return originalUpdateContent.call(this, message, ...rest);
  };

  proto.render = function (width, ...rest) {
    const rows = originalRender.call(this, width, ...rest);
    if (!shared.hooks.isOn()) return rows;
    // TD_HAS_THINKING is set by our updateContent wrapper. Fallback: if calm.js
    // loaded after us, its wrapper filters thinking blocks BEFORE ours sees
    // them — but calm stores the unfiltered original on `lastMessage`, which
    // still carries the thinking blocks.
    const hadThinking =
      this[TD_HAS_THINKING] === true || messageHasThinking(this.lastMessage);
    const hidden = this[TD_HIDE] ?? shared.hooks.globalHide?.() ?? false;
    const dbg = globalThis.process?.env?.TD_DEBUG === "1"
      ? (m) => { try { process.stderr.write(`[td] ${m}\n`); } catch {} }
      : () => {};
    dbg(`render isOn=${shared.hooks.isOn()} had=${hadThinking} hidden=${hidden}`);
    if (!hadThinking) return rows;
    if (!hidden) return rows;
    if (!Array.isArray(rows)) return rows;
    return [...rows, TD_LABEL_EXPAND];
  };

  registry[TD_PATCH] = shared;
}

export default function (pi) {
  const settings = () => pi.pi?.settings;
  // Default OFF: installing the extension hides thinking at every session
  // start (it writes hideThinkingBlock itself) and hidden reasoning leaves
  // no trace at all. /thinking-disclosure opts into a muted
  // `▸ Thinking · Ctrl+T to expand` row and persists the choice.
  let on = tdGet(settings(), TD_SETTING_ID, false);
  let tui = null;
  let mode = null;

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

  function globalHide() {
    const m = findMode();
    // Interactive sessions: the live ctx flag (Ctrl+T writes it per-toggle).
    if (m && typeof m.hideThinkingBlock === "boolean") return m.hideThinkingBlock;
    // Non-interactive surfaces (omp render, print): the persisted setting.
    return tdGet(settings(), "hideThinkingBlock", false);
  }

  function rebuildTranscript() {
    const m = findMode();
    if (!m || m.initialChatRendered !== true) return;
    try {
      m.rebuildChatFromMessages?.();
    } catch {
      // best-effort; new messages get the right layout anyway
    }
  }

  function setOn(next, ui) {
    on = next === true;
    const s = settings();
    if (s) {
      tdSet(s, TD_SETTING_ID, on);
      tdCommit(s);
    }
    rebuildTranscript();
    if (ui?.notify) {
      ui.notify(
        `Thinking disclosure ${on ? "on" : "off"} — hidden reasoning ${
          on ? "leaves a Ctrl+T row" : "is removed"
        }`,
      );
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    // Re-resolve the persisted flag for every surface. Module init can run
    // before pi.pi.settings exists, and UI-less sessions (omp render) bail
    // at hasUI below — refreshing here keeps `on` honest for both.
    const s = settings();
    on = tdGet(s, TD_SETTING_ID, on);
    if (!ctx.hasUI) return;
    // Probe widget: invisible, below the editor, captures the live TUI object
    // so we can reach InteractiveMode.hideThinkingBlock (same trick as calm).
    ctx.ui.setWidget(
      "td-probe",
      (t) => {
        tui = t;
        const m = findMode();
        // Probe may connect after session_start's enforcement ran with no
        // mode; apply the hidden flag here too so ordering is race-free.
        // Hide enforcement is unconditional — it is the extension's purpose,
        // independent of the opt-in disclosure row.
        if (m) m.hideThinkingBlock = true;
        return { render: () => [], invalidate: () => {}, dispose: () => {} };
      },
      { placement: "belowEditor" },
    );
    // Enforce hidden-by-default at every session start (like calm does for
    // tool activity): installing the extension alone hides thinking — the
    // user never needs hideThinkingBlock in config. Ctrl+T still expands.
    if (s) {
      tdSet(s, "hideThinkingBlock", true);
      const m = findMode();
      if (m) m.hideThinkingBlock = true;
      tdCommit(s);
    }
    const installed = installSafely();
    if (!installed.ok) ctx.ui.notify(`Thinking disclosure unavailable (${installed.error})`, "warning");
  });

  function installSafely() {
    try {
      // isOn re-reads the persisted setting per row: it is live for the
      // toggle AND correct on UI-less surfaces where session_start never
      // refreshed `on`.
      installDisclosurePatch(pi, {
        isOn: () => tdGet(settings(), TD_SETTING_ID, on),
        globalHide,
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  }

  // Install the patch at module load as well so non-interactive surfaces that
  // never fire session_start with a UI (e.g. `omp render`) still pick it up.
  // isOn is read live, so /thinking-disclosure applies wherever it installed.
  installSafely();

  pi.on("session_shutdown", async () => {
    tui = null;
    mode = null;
  });

  pi.registerCommand("thinking-disclosure", {
    description: "Toggle the Ctrl+T disclosure row for hidden thinking",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      setOn(!on, ctx.ui);
    },
  });
}
