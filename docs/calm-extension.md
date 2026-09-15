# Calm — hide tool activity, keep the conversation

Calm is a drop-in OMP extension that hides all tool-call and tool-result rows so the
transcript reads as agent prose. While the agent works, a small animated boat rides a
water line above the editor instead of the usual wall of tool output.

It is a port of firstmate's [`fm-calm`](https://github.com/kunchenguid/firstmate/blob/main/.pi/extensions/fm-calm.ts)
extension, adapted to OMP's extension API and native tool-activity toggle.

## What you get

- **Prose-only transcript.** Every tool row (built-in, MCP, and extension tools) is
  hidden. Mid-turn assistant "working notes" — the text a model emits right before
  firing more tool calls — are also hidden, so only genuine replies remain.
- **Boat widget.** A tiny animated sailboat on a rippling water line appears above the
  editor while a run is active, and disappears when the run settles.
- **`/calm` command.** Toggles the mode live in both directions.
- **On by default, every session.** Calm re-enables itself at every session start,
  so a `/calm` off-toggle never carries into the next session. It is an extension,
  not a binary patch, so it survives OMP updates.
- **Ctrl+T unaffected.** The thinking-block toggle stays fully independent.

## Install

```sh
mkdir -p ~/.omp/agent/extensions
curl -fsSL https://raw.githubusercontent.com/demetre19/omp-mods/main/artifacts/calm/calm.js \
  -o ~/.omp/agent/extensions/calm.js
```

Restart OMP. No build, no config, no dependencies — the file is self-contained.

To uninstall, delete the file and restart, or just run `/calm` to toggle it off.

## How it works

fm-calm hides tool rows by re-registering wrapped copies of Pi's built-in tools whose
renderers return empty output. This port instead drives OMP's **native** hide path —
the same one the built-in Ctrl+Shift+O toggle uses:

- `TranscriptContainer.setToolActivityVisible(false)` hides every tool-activity
  component, including ones added later in the session.
- The state is stored in OMP's own `display.hideToolActivity` setting, so `/calm`,
  Ctrl+Shift+O, and `/settings` all stay in sync. Calm sets it to `true` at every
  `session_start`, so new sessions always begin calm even if a previous session
  toggled it off.
- The live interactive-mode context is reached through the TUI component tree (the
  status container exposes it on a public `.mode` field); a zero-height probe widget
  below the editor captures the TUI instance at `session_start`.
- Working notes are hidden by a `Symbol.for`-guarded patch on
  `AssistantMessageComponent.prototype.updateContent` that filters `text` blocks from
  messages whose `stopReason` is `toolUse` (or `length` with tool calls). The
  thinking-block half of the original adapter is inert in OMP by construction, which
  is what keeps Ctrl+T independent.
- Submitting `/export` or `/share` while calm briefly restores tool rows so the
  rendered export still contains them, then re-hides on the next tick.

## Differences from upstream fm-calm

- Covers **all** tools, not just the wrapped built-ins, because it uses the native
  container flag rather than per-tool renderer overrides.
- The stock `Working…` status row stays visible next to the boat — OMP exposes
  `setWorkingMessage` but not `setWorkingVisible`.
- firstmate's operational-input classifier and synthetic-user layout are not ported;
  they depend on a firstmate supervisor shell script that does not exist here.

## Compatibility

Verified against OMP **v18.1.21** (Bun-compiled binary). The extension uses only
public extension API surface (`pi.on`, `pi.registerCommand`, `ctx.ui.setWidget`,
`pi.pi.settings`, `pi.pi` component classes) plus two stable internals:
`AssistantMessageComponent.prototype.updateContent` and the status container's
`.mode` field. If a future OMP release renames either, the assistant-note filter
degrades gracefully (a warning is shown, tool hiding still works).

## Files

- [`artifacts/calm/calm.js`](../artifacts/calm/calm.js) — the extension, single file.
