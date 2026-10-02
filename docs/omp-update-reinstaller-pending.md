# Pending: automatic OMP customization reinstaller

## Status

Paused by user on 2026-09-01. Do not activate the work-in-progress update wrapper until the resource-safe rebuild path and complete update simulation are verified.

No rebuild, Bun install, patching, or updater process is running. The cancelled disposable worktree and update lock were removed.

## Current safe runtime

- Active OMP: direct executable at `~/.local/bin/omp`
- Version: `18.0.11`
- SHA-256: `794b3af1c05ffb0f197319a369385fbc6b3989daffcf566cd088633f803f9968`
- Durable identical copy: `~/.local/libexec/omp-devin/current/omp`
- Thinking disclosure remains active in this binary.
- `omp update` is not blocked; `omp update --help` returns the normal official updater interface.
- The launcher-restoration LaunchAgent is unloaded.

Because the active entrypoint is currently a normal binary, running an OMP update before this work resumes will update OMP normally but may remove the custom thinking disclosure from the active binary. The durable `18.0.11` artifact and source patches remain available for restoration.

## Why a rebuild is required

OMP's extension API can append components after already-visible thinking, but it cannot suppress and wrap the core reasoning block. The disclosure therefore changes OMP's assistant-message renderer and must be rebuilt against each OMP release unless the feature is accepted upstream.

## Work completed

The proposed external update flow exists under `~/.local/libexec/omp-devin/updater/` but is not active:

- `update-with-customizations.sh`
- `activate-version.sh`
- `patches/10-devin-plan.patch`
- `patches/20-thinking-disclosure.patch`
- `logs/`

Portable copies are under `omp-mods/artifacts/thinking-disclosure/updater/`.

Verified so far:

1. The shell scripts pass syntax validation.
2. An isolated staged `omp update --check` ran OMP's official updater successfully and reported `18.0.11` current.
3. A detached worktree at source commit `65f79e7` was created without touching the user's dirty checkout.
4. Both saved patches applied cleanly with Git's three-way mode.
5. The full proof was stopped during `bun install --frozen-lockfile --ignore-scripts` because the dependency installation consumed enough workstation resources to make current sessions feel slower.

Not verified:

- completion of the dependency install in the disposable worktree,
- focused tests and coding-agent checks inside the automatic flow,
- automatic compilation and activation of a new versioned binary,
- fallback activation of an official updated binary if patching or building fails,
- a complete simulated version upgrade.

## Required resume work

1. Make the rebuild non-disruptive. Prefer bounded low-priority execution (`nice`/macOS background task policy), reuse a safe persistent dependency cache, and avoid concurrent builds while interactive OMP sessions are busy.
2. Keep OMP's official update first and isolated from the active launcher.
3. Guarantee that a customization failure still activates the verified official release and reports the log path.
4. Run a complete update simulation in an isolated durable root before changing `~/.local/bin/omp` or loading the LaunchAgent.
5. Verify the real TUI disclosure after the rebuilt release activates.
6. Only after those checks, activate the external launcher and its restoration LaunchAgent.
7. Update `README-omp-thinking-disclosure.md`, `omp-mods/docs/thinking-disclosure.md`, and the Orca settings changelog from “pending” to the verified final workflow.

## Resume boundary

Start by reading this file and `Orca settings/AGENTS.md`. Do not rerun `update-with-customizations.sh --reapply-customizations` unchanged; that is the resource-heavy proof the user explicitly paused.

## 2026-09-05: updated to 18.1.10, devin-plan retired

- User asked to drop the `/devin-plan` customization. `updater/patches/10-devin-plan.patch` moved to `updater/patches-retired/`.
- `20-thinking-disclosure.patch` does not apply to v18.1.10 either (upstream refactored `assistant-message.ts`, `chat-transcript-builder.ts`, `interactive-context-helpers.ts`). It needs a rebase before disclosure can be rebuilt.
- Fixed a symlink bug in `update-with-customizations.sh` (`activate_artifact`) and `updater/activate-version.sh`: `mv -f newlink current` on macOS moves the link inside the old target dir instead of replacing `current`. Now removes `current` first. Stray `current.next.*` links cleaned out.
- Active binary is now `18.1.10-upstream` (`omp/18.1.10`), `hideThinkingBlock=true`. `thinkingDisclosure` key absent on pure upstream, so the disclosure customization is dormant until the patch is rebased.
## 2026-09-07: custom launcher was active and triggered a source rebuild

- Running `ou` (`omp update`) started `~/.local/libexec/omp-devin/updater/update-with-customizations.sh`, which applied `20-thinking-disclosure.patch` and began a full `bun install`, `packages/natives` Rust build, and `packages/coding-agent` build.
- The custom `~/.local/bin/omp` launcher script was still active, despite the notes above treating the prototype as paused.
- Stopped the build, removed `updater/work.RYuMk8` and `updater/update.lock`, and unloaded both `dev.demetre.omp-durable-launcher` and `com.omp.auto-update`.
- Renamed both plists to `.disabled-20260907-134600`.
- Replaced `~/.local/bin/omp` with the official `18.1.12-upstream` binary and ran a normal `omp update`, which downloaded and installed `18.1.13` in ~23 seconds with no source build.
- `com.omp.auto-update` is disabled because its `~/.omp/bin/omp-auto-update.sh` also ran `omp-apply-local-patches.sh` (the mid-text skill-autocomplete rebuild).
- The durable custom artifacts (`~/.local/libexec/omp-devin/18.1.12-upstream`, `18.1.13` after official update, plus the saved source patches and `launcher/` files) remain for future re-enable if a safe non-disruptive rebuild is desired.

## 2026-09-07 - Manual rebuild helper and cancellation

- Created `~/.local/libexec/omp-devin/rebuild-thinking-disclosure.sh` as a non-launcher, manual rebuild path for the 18.1.13 `20-thinking-disclosure.patch`.
- The helper builds in a persistent worktree at `~/.local/libexec/omp-devin/build/18.1.13` and a persistent Cargo target cache at `~/.local/libexec/omp-devin/cargo-target/18.1.13` so the heavy `packages/natives` compilation can be reused across attempts.
- A build attempt was started, then cancelled when the user observed that the upstream `hideThinkingBlock` setting already provides thinking-block hiding without a source build.
- The partial build tree, Cargo target cache, and `rebuild.lock` were removed after cancellation.
- The `rebuild-thinking-disclosure.sh` helper and the saved `20-thinking-disclosure.patch` remain for a future explicit decision to build the custom disclosure.
