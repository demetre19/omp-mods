# OMP skill dropdown selected-description style

## System modified

- OMP / CMUX / both: OMP.
- Platform: cross-platform OMP TUI behavior; verified on macOS arm64.
- CMUX required: no.

## Prerequisites

- Editable OMP checkout: `~/.omp/wt/oh-my-pi-skill-autocomplete`.
- Active OMP binary path on this workstation: `~/.local/bin/omp`.
- Bun `1.3.14` or newer for this source tree.
- If binary print mode fails with a `pi_natives` version-sentinel mismatch, rebuild natives with `bun --cwd=packages/natives run build` before rebuilding the coding-agent binary.

## What this change does

The selected row in slash/skill autocomplete no longer applies the selected primary-text style to the skill description. The selected skill name still uses the selected/accent styling, but the description column keeps the normal description/muted styling on both the first wrapped row and continuation rows.

This fixes the visual regression where the first selected skill description appeared extra dark after a previous change made selected text bolder/darker.

## Why this change exists

Skill descriptions are long explanatory text. Styling the whole selected row as selected text made the first skill row visually heavier than the rest of the dropdown and reduced readability, especially in the skills-only autocomplete view.

## Files to create or edit

- `~/.omp/wt/oh-my-pi-skill-autocomplete/packages/tui/src/components/select-list.ts` - render selected description text with `theme.description(...)` instead of wrapping it in `theme.selectedText(...)`.
- `~/.omp/wt/oh-my-pi-skill-autocomplete/packages/tui/test/select-list.test.ts` - add regression coverage using real ANSI SGR sequences so `visibleWidth` behavior matches terminal rendering.

## LLM recreation instructions

Give these instructions to an LLM:

1. Open `packages/tui/src/components/select-list.ts` in the OMP checkout.
2. In `SelectList.#renderItem`, find the `layout.kind === "description"` branch.
3. For selected wrapped descriptions, change the first row from styling `${prefix}${truncatedValue}${spacing}${first}` entirely with `theme.selectedText(...)` to concatenating:
   - `theme.selectedText(`${prefix}${truncatedValue}`)`
   - `theme.description(`${spacing}${first}`)`
4. For selected wrapped continuation rows, render each continuation as `theme.description(`${indent}${wrapped[i]}`)` rather than `theme.selectedText(...)`.
5. For selected single-line descriptions, change the return value from styling `${prefix}${truncatedValue}${spacing}${truncatedDesc}` entirely with `theme.selectedText(...)` to concatenating:
   - `theme.selectedText(`${prefix}${truncatedValue}`)`
   - `theme.description(`${spacing}${truncatedDesc}`)`
6. Add regression tests in `packages/tui/test/select-list.test.ts` that create a `SelectList` with `selectedText` returning `\x1b[1m...\x1b[22m` and `description` returning `\x1b[2m...\x1b[22m`, then assert the selected row starts with the selected label followed by the description style and does not contain selected styling around the description text.
7. Run targeted verification:

```bash
bun test packages/tui/test/autocomplete.test.ts packages/tui/test/editor-autocomplete-actions.test.ts packages/tui/test/select-list.test.ts
bun --cwd=packages/tui run check
```

8. Build and smoke-test before installing:

```bash
bun --cwd=packages/natives run build
bun --cwd=packages/coding-agent run build
packages/coding-agent/dist/omp --version
packages/coding-agent/dist/omp -p --no-tools "Reply exactly OK"
```

9. Back up `~/.local/bin/omp`, copy the built binary to a new temporary path under `~/.local/bin/`, verify that temporary path with `--version`, then atomically rename it to `~/.local/bin/omp`.
10. Verify the installed command:

```bash
omp --version
omp -p --no-tools "Reply exactly OK"
```

## Verification

- `bun test packages/tui/test/select-list.test.ts` passed: 24 tests, 65 assertions.
- `bun test packages/tui/test/autocomplete.test.ts packages/tui/test/editor-autocomplete-actions.test.ts packages/tui/test/select-list.test.ts` passed: 99 tests, 233 assertions.
- `bun --cwd=packages/tui run check` passed.
- `bun --cwd=packages/coding-agent run build` completed and produced `packages/coding-agent/dist/omp`.
- Built binary smoke test passed: `packages/coding-agent/dist/omp --version` reported `omp/16.3.12`, and print mode returned `OK`.
- Installed binary smoke test passed: `~/.local/bin/omp --version` reported `omp/16.3.12`, and `~/.local/bin/omp -p --no-tools "Reply exactly OK"` returned `OK`.

## Notes for non-CMUX users

This is an OMP TUI fix and does not depend on CMUX. Users only need a rebuilt/reinstalled OMP binary. Existing OMP sessions may need to be restarted so they use the newly installed binary.
