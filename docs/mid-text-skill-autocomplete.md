# OMP mid-text skill autocomplete

## System modified

- OMP / CMUX / both: OMP.
- Platform: macOS verified; source change is cross-platform TypeScript in OMP TUI.
- CMUX required: no.

## Prerequisites

- Editable Oh My Pi source checkout.
- Bun >= 1.3.14 for this OMP source tree.
- Paths used on this workstation:
  - Source checkout: `~/.omp/wt/oh-my-pi-skill-autocomplete`
  - Active binary: `~/.local/bin/omp`
  - Original binary backup: `~/.local/bin/omp.backup-16.1.23-skill-autocomplete-20260627-125946`
  - Stale killed copy kept for debugging: `~/.local/bin/omp.stale-killed-copy-20260627-130100`

## Status

Re-patched locally on 2026-06-29 after upstream still replaced the draft when accepting a mid-prompt skill.

- Source checkout: `~/.omp/wt/oh-my-pi-skill-autocomplete`.
- Base: clean `origin/main` (`ca9f2847e`, OMP `16.2.5`) before this local patch.
- Active binary patched and installed at `~/.local/bin/omp`.
- Backup created at `~/.local/bin/omp.backup-16.2.5-inline-skill-20260629`.

## Current local behavior

Typing a slash skill selector after existing prompt text opens a skills-only autocomplete list. Selecting a skill now preserves the draft and replaces only the slash token:

```text
explain this
/security
```

accepts to:

```text
explain this
/skill:security-scan
```

The replacement ends with one literal space, leaving the cursor ready for the next word without storing invisible whitespace in this example.

Submitting text with an inline skill token invokes the skill and passes the surrounding prompt text as the skill args:

```text
review this /skill:test-skill carefully
```

invokes `test-skill` with user args:

```text
review this carefully
```

Line-start slash behavior remains unchanged: `/` at the beginning opens the full command palette.

## Files changed

- `packages/tui/src/autocomplete.ts` - mid-prompt skill completion now preserves draft lines/text and inserts `/skill:<name> ` in place.
- `packages/coding-agent/src/modes/skill-command.ts` - skill command parsing now accepts one registered inline `/skill:<name>` token and removes that token from the user args.
- `packages/tui/test/autocomplete.test.ts` - provider regression for preserving mid-prompt text.
- `packages/tui/test/editor-autocomplete-actions.test.ts` - editor regression for preserving text on Tab.
- `packages/coding-agent/test/input-controller-skill-queue.test.ts` - submit/compaction regressions for inline skill tokens.

## Verification

- `bun test packages/tui/test/autocomplete.test.ts packages/tui/test/editor-autocomplete-actions.test.ts packages/coding-agent/test/input-controller-skill-queue.test.ts`: `74 pass`, `0 fail`.
- `bun --cwd=packages/tui run check`: passed.
- `bun --cwd=packages/coding-agent run check`: passed.
- `packages/coding-agent/dist/omp --version`: `omp/16.2.5`.
- `packages/coding-agent/dist/omp -p --no-tools "Reply exactly OK"`: `OK`.
- `omp --version`: `omp/16.2.5`.
- `omp -p --no-tools "Reply exactly OK"`: `OK`.
