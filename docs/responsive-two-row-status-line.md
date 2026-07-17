# Responsive two-row OMP status line

## System modified

- OMP / CMUX / both: OMP
- Platform: cross-platform OMP behavior; verified on macOS arm64
- CMUX required: no

## Prerequisites

- Editable Oh My Pi checkout with Bun 1.3.14 or newer.
- The repository lockfile and JDK/Rust toolchain needed by OMP's existing build.
- On this workstation the checkout was `~/.omp/wt/oh-my-pi-skill-autocomplete` and the active binary was `~/.local/bin/omp`.

## What this change does

When the editor's available status width is 88 terminal columns or fewer, OMP renders the configured status segments as two typed editor-border rows instead of dropping most segments into a single narrow row. Model, mode, collaboration, context, cost, and usage information stay on the primary row; path, git, session, time, runtime-job, and other configured details use the secondary row. Wider terminals retain the existing single-row layout.

The editor treats the secondary status row as real layout chrome rather than embedding a newline in one border string, so height limits, scrolling, clipping, and differential rendering continue to use valid rows.

## Why this change exists

CMUX Mobile Connect reports a narrow terminal viewport on phones. OMP's former single-row overflow policy dropped useful status segments, leaving a very thin bar with little information. A responsive two-row layout preserves useful context without requiring a separate CMUX or Android configuration.

## Files to create or edit

- `packages/coding-agent/src/modes/components/status-line/component.ts` - partition narrow status segments into primary and secondary rows while preserving the desktop layout.
- `packages/tui/src/components/editor.ts` - add a typed optional secondary top-border row and include it in editor height accounting/rendering.
- `packages/coding-agent/test/status-line-overflow.test.ts` - verify bounded two-row mobile output and unchanged desktop output.
- `packages/tui/test/editor-top-border-provider.test.ts` - verify the secondary row renders without exceeding editor max height.

## LLM recreation instructions

Give these instructions to an LLM:

1. Extend the editor top-border result with an optional typed `secondary` row containing `content` and visible `width`.
2. Resolve the top border before calculating visible editor content height. Subtract one additional chrome row when `secondary` exists.
3. Render the primary row as the existing top border and the secondary row directly below it inside the editor's left/right borders. Truncate each row through the existing ANSI-aware width helper; never insert a newline into status content.
4. In `StatusLineComponent.getTopBorder`, keep the current single-row builder for widths above 88 columns.
5. At widths of 88 columns or fewer, partition the configured left/right segment IDs. Keep `pi`, `model`, `mode`, `collab`, `context_pct`, `context_total`, `cost`, and `usage` on the primary row; put the remaining configured segments on the secondary row.
6. Render runtime/subagent badges only on the secondary row. Preserve focused-agent dimming on both rows.
7. Return a secondary row only when both partitions contain configured segments; otherwise preserve the existing single-row result.
8. Keep legacy gap/overflow contracts on desktop widths when they specifically test single-row behavior.
9. Restore locked dependencies with lifecycle scripts disabled if needed: `bun install --frozen-lockfile --ignore-scripts`.
10. Build `packages/natives` before the production binary if the cached native-addon sentinel is stale, then rebuild `packages/coding-agent`.
11. Back up the active OMP binary, verify a newly copied path, and atomically rename it over `~/.local/bin/omp`; do not copy bytes directly over the active executable.

## Verification

- `bun test packages/tui/test/editor-top-border-provider.test.ts packages/coding-agent/test/status-line-overflow.test.ts`
  - Observed: 17 passed, 0 failed.
- Broader focused status contracts.
  - Observed: 23 passed, 0 failed.
- `bun --cwd=packages/tui run check`
  - Observed: passed.
- `bun --cwd=packages/coding-agent run check`
  - Observed: passed after restoring the locked dependency install.
- `bun --cwd=packages/natives run build`
  - Observed: native addon built for darwin-arm64.
- `bun --cwd=packages/coding-agent run build`
  - Observed: production binary built successfully.
- `~/.local/bin/omp --version`
  - Observed: `omp/16.5.1`.
- `~/.local/bin/omp -p --no-tools "Reply exactly OK"`
  - Observed: `OK` from the installed binary.
- Restart or reconnect the mobile OMP terminal so it launches the replaced host binary, then confirm two status rows at a phone-width viewport and one row on a wide desktop viewport.

## Notes for non-CMUX users

The responsive behavior is entirely in OMP and applies to any narrow terminal, including Windows and Linux terminals. CMUX is not required. Existing OMP processes must be restarted because the binary is loaded at process startup.
