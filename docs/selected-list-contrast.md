# OMP multiple-choice selected-row contrast fix

## System modified

- Modifies OMP only, specifically the coding-agent TUI renderer used by hook/ask multiple-choice prompts.
- Platform scope: macOS on this workstation for the installed binary; source patch is cross-platform TypeScript.
- CMUX is not required for the behavior, but this note lives in the CMUX settings folder for sharing with CMUX/OMP users.

## Prerequisites

- Editable OMP checkout: `~/.omp/wt/oh-my-pi-skill-autocomplete`.
- Active installed command: `~/.local/bin/omp`.
- Bun `1.3.14` for this source tree.
- Native addon build/cache must match the OMP version. On this workstation the required cache path is `~/.omp/natives/16.3.11/pi_natives.darwin-arm64.node`.

## What was done

- Fixed the actual multiple-choice prompt renderer: `HookSelectorComponent`.
- Selected radio/checkbox rows now choose a contrast foreground from `selectedBg` luminance, so the selected label, description, and marker render as explicit bold black text on light/electric-blue selected backgrounds instead of accent-blue/muted-blue or white.
- The `titanium` theme's selected row background was changed from `deepBlue` (`#0082b3`) to brighter `electricBlue` (`#00b4ff`), and ask-picker option rows now include extra left padding around answer text.
- Edited:
  - `packages/coding-agent/src/modes/components/hook-selector.ts`
  - `packages/coding-agent/src/modes/theme/theme.ts`
  - `packages/coding-agent/src/modes/theme/defaults/titanium.json`
- Added/updated regression tests:
  - `packages/coding-agent/test/hook-selector-overflow.test.ts`
  - `packages/coding-agent/test/modes/theme/theme-getters-preinit.test.ts`
- Installed a rebuilt OMP binary to `~/.local/bin/omp`.
- Backups created:
  - `~/.local/bin/omp.backup-20260707-contrast`
  - `~/.local/bin/omp.backup-20260707-hook-contrast`
  - `~/.local/bin/omp.backup-20260708-titanium-contrast`
  - `~/.local/bin/omp.backup-20260708-electric-selected-row`

## Why it was done

OMP multiple-choice prompts could render the selected row as light-blue/blue background with blue, muted-blue, or white text underneath. That made the recommended option and its description hard to read. The selected row should use a brighter electric-blue focus band, add breathing room around answer rows, and draw all selected-row text as bold black on that band.

## How it was achieved

Add a background contrast helper to `Theme` in `packages/coding-agent/src/modes/theme/theme.ts`:

```ts
getContrastBgFgAnsi(fillColor: ThemeBg): string {
	const ansi = this.#bgColors[fillColor];
	const match = ansi ? /48;2;(\d+);(\d+);(\d+)/.exec(ansi) : null;
	if (!match) return this.#fgColors.text;
	const luma = 0.299 * Number(match[1]) + 0.587 * Number(match[2]) + 0.114 * Number(match[3]);
	return luma > 80 ? "\x1b[38;2;0;0;0m" : "\x1b[38;2;255;255;255m";
}
```

Use it in `getSelectListTheme()`:

```ts
selectedPrefix: (text: string) => `\x1b[1m${theme.getContrastBgFgAnsi("selectedBg")}${text}\x1b[22m\x1b[39m`,
selectedText: (text: string) => `\x1b[1m${theme.getContrastBgFgAnsi("selectedBg")}${text}\x1b[22m\x1b[39m`,
```

Patch `packages/coding-agent/src/modes/components/hook-selector.ts` because that is the renderer used by OMP ask/multiple-choice prompts:

```ts
function selectedRowText(content: string): string {
	return `\x1b[1m${theme.getContrastBgFgAnsi("selectedBg")}${content}\x1b[22m\x1b[39m`;
}
```

Then route selected labels, selected descriptions, selected radio markers, selected checkbox markers, and the fallback selected cursor prefix through `selectedRowText()` before `paintSelectedRow()` applies `selectedBg` to the whole row. The explicit `\x1b[1m`/`\x1b[22m` bold SGR is intentional because `theme.bold()` can be a no-op in non-interactive render paths; the `80` luma cutoff keeps the user's original medium-blue `titanium` selection band (`#0082b3`) on black text, and the final theme change moves that band to brighter electric blue (`#00b4ff`).

For the `titanium` theme, set the selected row to the brighter existing electric blue token:

```json
"selectedBg": "electricBlue"
```

For ask-picker answer padding, selected and unselected radio/checkbox marker prefixes now start with two spaces, and description rows use six-space indentation.

Build and install sequence used:

```bash
cd ~/.omp/wt/oh-my-pi-skill-autocomplete
bun test packages/coding-agent/test/hook-selector-overflow.test.ts
bun test packages/coding-agent/test/modes/theme/theme-getters-preinit.test.ts
bun --cwd=packages/coding-agent run check
bun --cwd=packages/coding-agent run build
cp packages/coding-agent/dist/omp ~/.local/bin/omp-patched-hook-contrast-test
~/.local/bin/omp-patched-hook-contrast-test --version
~/.local/bin/omp-patched-hook-contrast-test -p --no-tools "Reply exactly OK"
cp ~/.local/bin/omp ~/.local/bin/omp.backup-20260708-electric-selected-row
mv ~/.local/bin/omp-patched-hook-contrast-test ~/.local/bin/omp
```

Install with `mv` onto `~/.local/bin/omp`, not `cp` directly over a live mapped executable inode. A direct overwrite can leave the installed path exiting `137` until the binary is replaced atomically with a fresh inode.

## Verification

Focused tests:

```text
bun test packages/coding-agent/test/hook-selector-overflow.test.ts
17 pass, 0 fail

bun test packages/coding-agent/test/modes/theme/theme-getters-preinit.test.ts
6 pass, 0 fail
```

Package check:

```text
bun --cwd=packages/coding-agent run check
bun check: passed
root biome: ok
```

Installed binary smoke test:

```text
~/.local/bin/omp --version
omp/16.3.11

~/.local/bin/omp -p --no-tools "Reply exactly OK"
OK
```

The prompt smoke test may also print an existing annotation-bridge extension warning if port `47890` is already in use; that warning is unrelated to this contrast patch.

Live sessions must be fully restarted to pick up the patched executable. A running `omp --resume ...` process keeps its original executable image in memory even after `~/.local/bin/omp` is replaced. On 2026-07-07 the active session on `ttys002` was verified to have started before the install and was still mapped to inode `460228169`, while the installed patched binary at the same path had inode `460275930`.

## Compatibility notes

- The source changes are cross-platform because they only change TypeScript ANSI styling.
- The install commands and native addon cache path above are macOS arm64-specific.
- Users without CMUX still get the fix by installing the rebuilt OMP binary; CMUX is only relevant to where this shareable note is stored.
- Windows users should rebuild and install OMP using their platform's native addon artifact/cache path rather than `pi_natives.darwin-arm64.node`.
