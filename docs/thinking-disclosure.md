# Collapsible thinking disclosure

## Purpose

OMP normally either renders every reasoning block inline or removes it from the transcript when `hideThinkingBlock` is enabled. This modification adds an opt-in middle state:

- collapsed: `▸ Thinking · Ctrl+T to expand`
- expanded: `▾ Thinking · Ctrl+T to collapse`, followed by the original reasoning
- streaming while collapsed: the existing thinking pulse gains `Ctrl+T to expand`

The model still reasons normally. This is a display change, not a reduction in reasoning effort. `Ctrl+T` remains OMP's existing global thinking-visibility action; the transcript row is a keyboard disclosure, not a mouse target.

Two install paths exist:

- **Drop-in extension** — [`thinking-disclosure.js`](../artifacts/thinking-disclosure/thinking-disclosure.js).
  Copy it to `~/.omp/agent/extensions/` and restart OMP. It reproduces the
  collapsed-row presentation at render time by wrapping
  `AssistantMessageComponent.prototype` (`updateContent` marks thinking
  content, `render` appends the label row while hidden, `setHideThinkingBlock`
  tracks the toggle). No rebuild, survives `omp update`, toggles live with
  `/thinking-disclosure`, and persists `thinkingDisclosure` through OMP's own
  settings store. Verified against **18.4.8**. Limitations vs the binary patch:
  the row is appended to the component's rendered rows, so it appears after
  the turn's visible content rather than at the block's original position;
  exports and native-terminal (Tern) surfaces are unaffected; and if calm.js
  also filters thinking, the row relies on calm's `lastMessage` shadow field.
- **Binary patch** (below) — the original implementation, needed only if you
  want the row inside exported transcripts/snapshots or the source-level
  `thinkingDisclosure` schema entry. Requires rebuilding the binary per
  release and is overwritten by `omp update`.

## Tested base

- OMP: `18.0.11`
- source commit: `65f79e7`
- Bun: `1.3.14`
- patch: [`../artifacts/thinking-disclosure/omp-18.0.11-65f79e7.patch`](../artifacts/thinking-disclosure/omp-18.0.11-65f79e7.patch)
- patch SHA-256: `72447ba85984123491a8db9b3b91d977e51074bca5049bafb2c977e7d03769e7`

Review and rebase the patch when OMP's assistant transcript renderer or settings schema changes.

## Automatic update status

The disclosure patch and OMP `18.0.11` binary are verified. The automatic post-update source rebuild described below is a preserved **work in progress**, not an active verified installer. Its staged official update check and patch application succeeded, but the proof build was stopped during dependency installation because it affected interactive workstation performance.

The workstation handoff is [`omp-update-reinstaller-pending.md`](omp-update-reinstaller-pending.md).

## Source changes

The patch touches only these OMP paths:

- `packages/coding-agent/src/modes/components/assistant-message.ts`
- `packages/coding-agent/src/modes/components/chat-transcript-builder.ts`
- `packages/coding-agent/src/modes/controllers/selector-controller.ts`
- `packages/coding-agent/src/modes/utils/interactive-context-helpers.ts`
- `packages/coding-agent/src/config/settings-schema.ts`
- `packages/coding-agent/test/modes/components/assistant-message-error.test.ts`
- `packages/coding-agent/test/modes/components/assistant-message-mermaid.test.ts`
- `packages/coding-agent/CHANGELOG.md`
- `docs/settings.md`

The new `thinkingDisclosure` setting defaults to `false`, so unconfigured OMP installations preserve their existing behavior. When enabled with `hideThinkingBlock`, hidden reasoning is replaced by the disclosure row. Expanded disclosure headers participate in OMP's append-only thinking snapshots so long reasoning streams can still retire safely into terminal scrollback.

## Apply and build

From a clean checkout at the tested commit:

```sh
git apply --check ~/path/to/omp-mods/artifacts/thinking-disclosure/omp-18.0.11-65f79e7.patch
git apply ~/path/to/omp-mods/artifacts/thinking-disclosure/omp-18.0.11-65f79e7.patch
bun test packages/coding-agent/test/modes/components/assistant-message-error.test.ts packages/coding-agent/test/modes/components/assistant-message-mermaid.test.ts
bun --cwd=packages/coding-agent run check
bun --cwd=packages/coding-agent run build
packages/coding-agent/dist/omp --version
packages/coding-agent/dist/omp -p --no-tools "Reply exactly OK"
```

Enable the presentation after installing the patched binary:

```sh
omp config set hideThinkingBlock true
omp config set thinkingDisclosure true
```

## Proposed update-aware external installation

The unverified design keeps the launcher, updater, patch bundle, source cache, and immutable builds outside Orca and OMP's normal replacement paths:

```text
~/.local/libexec/omp-devin/
  current -> <version>-<commit>-thinking-disclosure/
  <version>-<commit>-thinking-disclosure/
    omp
    activate.sh
  launcher/
    omp
    restore.sh
  updater/
    update-with-customizations.sh
    activate-version.sh
    patches/
      10-devin-plan.patch
      20-thinking-disclosure.patch
    logs/
```

The scripts under [`../artifacts/thinking-disclosure/`](../artifacts/thinking-disclosure/) are recovery and continuation artifacts. Do not install the update wrapper or load the LaunchAgent until the pending verification is complete.

The proposed `~/.local/bin/omp` launcher would run normal commands from `current/omp` and route only `omp update` through the external updater:

1. copy the active binary into a disposable staging `PATH`,
2. run OMP's unmodified official updater against that staged binary,
3. detect the installed release version,
4. check out the exact `v<version>` tag in a disposable worktree,
5. skip patches already integrated upstream or apply the saved patches with Git's three-way mode,
6. use the release lockfile with lifecycle scripts disabled, then explicitly build OMP's native package,
7. run the focused tests, coding-agent check, and binary build,
8. install the verified result in a new immutable version directory and atomically repoint `current`.

If fully verified, a patching, test, check, or build failure after the official update succeeds must activate the verified official staged binary instead. It must report the customization failure and log path without blocking or rolling back the OMP release.

The user LaunchAgent only protects the external launcher from Orca or installer replacement. Its lifecycle remains finite and event-driven:

```text
login or launcher replacement
  -> compare canonical and active launcher
  -> identical: exit
  -> different: one atomic restore, then exit
  -> restore event may invoke one final compare, which exits unchanged
```

There is no timer, retry loop, or `KeepAlive` process.

## Pending resume workflow

The intended final user command remains:

```sh
omp update
```

Before activating that behavior, finish the work listed in [`omp-update-reinstaller-pending.md`](omp-update-reinstaller-pending.md): resource-safe dependency installation, low-priority compilation, full tests/check/build completion, verified official-binary fallback, and an isolated version-upgrade simulation.

The work-in-progress script and patches are preserved under `artifacts/thinking-disclosure/updater/`. Do not run the current reapply command unchanged on an interactive workstation.

## Verification recorded on the tested base

- 33 focused assistant-message tests passed with 97 expectations.
- The coding-agent check passed across 2,860 files and TypeScript.
- The compiled binary returned `omp/18.0.11` and completed a print-mode `OK` smoke test.
- A live Devin-backed TUI rendered the collapsed disclosure, expanded it with `Ctrl+T` to reveal reasoning, and collapsed it again.
- `omp update --check` ran OMP's official updater successfully in the isolated staging path.
- Replacing `~/.local/bin/omp` with another executable triggered one restore plus one final no-op event; the restored launcher immediately returned `omp/18.0.11`.
