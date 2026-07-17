# OMP spellcheck/autocorrect autocomplete

## System modified

- OMP / CMUX / both: OMP.
- Platform: macOS verified; source change is cross-platform TypeScript in OMP TUI/coding-agent autocomplete.
- CMUX required: no.

## Status

Implemented locally on 2026-07-06.

- Source checkout: `~/.omp/wt/oh-my-pi-skill-autocomplete`.
- Base after refresh: `origin/main`, OMP `16.3.9`.
- Active binary patched and installed at `~/.local/bin/omp`.
- Initial backup created at `~/.local/bin/omp.backup-16.3.9-spellcheck-20260706-151644`.
- Repair backup created at `~/.local/bin/omp.backup-16.3.9-spellcheck-repair-20260706-152910`.
- Dictionary-backed repair backup created at `~/.local/bin/omp.backup-16.3.9-dictionary-spellcheck-20260706-162138`.
- Inline-only repair backup created at `~/.local/bin/omp.backup-16.3.9-inline-only-spellcheck-20260706-163311`.
- AU nspell repair backup created at `~/.local/bin/omp.backup-16.3.9-au-nspell-20260706-065857`.
- Suggestion-ranker repair backup created at `~/.local/bin/omp.backup-16.3.9-spellcheck-ranker-20260706-073309`.
- Learned-words repair backup created at `~/.local/bin/omp.backup-16.3.9-spellcheck-learned-words-20260706-075502`.
- Mobile-chunk repair backup created at `~/.local/bin/omp.backup-16.3.9-spellcheck-mobile-chunks-20260706-080922`.
- Quality-pass repair backup created at `~/.local/bin/omp.backup-16.3.9-spellcheck-quality-20260706-082919`.

## Current local behavior

OMP now has a conservative spellcheck/autocorrect layer in the prompt autocomplete path.

### Inline-only autocorrect

Typing a safe typo followed by a delimiter rewrites the current word immediately. Spellcheck no longer opens the autocomplete dropdown for plain English words.

Examples:

```text
teh            -> the
dictoionary    -> dictionary
aboev          -> above
exactkt        -> exactly
whye           -> why
nit            -> not
thar           -> that
cam            -> can
sortef         -> sorted
mucj           -> much
beter          -> better
bur            -> but
speel          -> spell
auto-corrction -> auto-correction
bely           -> best
thus           -> this
realli         -> really
goid           -> good
whet           -> what
expectef       -> expected
worfs          -> words
speled         -> spelled
corectly       -> correctly
autocomenple   -> autocomplete
autocomeplete  -> autocomplete
noe            -> now
```

The current repair uses `nspell` with the Australian English `dictionary-en-au` Hunspell data. The dictionary data is embedded into `packages/coding-agent/src/modes/spellcheck-dictionary-en-au.generated.ts` so the compiled Bun binary does not need runtime `.aff`/`.dic` files. Explicit high-confidence typo mappings still run first so real-word prompt typos such as `nit -> not`, `bely -> best`, `whet -> what`, and `thus -> this` can be corrected safely. For dictionary suggestions, OMP scans the full `nspell` suggestion list for safe common prompt words within edit distance 2, so `exactkt -> exactly` works even though `nspell` ranks `exacter` first. OMP also supports persisted local learned words and custom replacements in `~/.omp/agent/spellcheck-words.json`, so project terms such as `cmux` can be ignored and personal typo pairs can be corrected without rebuilding OMP.

The mobile/composed-input repair fixes a TUI boundary issue: terminal input can arrive as a multi-character printable chunk such as `nit ` rather than separate `n`, `i`, `t`, ` ` events. The editor now runs synchronous inline replacement for single-line printable chunks, not only `char.length === 1`, while leaving paste/bulk insertion paths unchanged. The latest explicit mappings also cover the user-reported phrase `this is something thar cam be sortef ` -> `this is something that can be sorted `.

The quality-pass repair expands safe AU dictionary-backed corrections for common prompt words such as `mucj -> much`, `beter -> better`, and `speel -> spell`, adds the real-word mobile typo `bur -> but`, and permits natural-language hyphenated corrections such as `auto-corrction -> auto-correction` without weakening URL, path, slash-command, or property-access guards.


### Learned words and custom replacements

The active binary now includes a small local CLI for maintaining user vocabulary:

```bash
omp spellcheck learn cmux
omp spellcheck unlearn cmux
omp spellcheck replace autocorrel autocorrect
omp spellcheck forget autocorrel
omp spellcheck list
omp spellcheck path
```

Learned ignored words suppress every correction source: built-in typo mappings, custom replacements, and AU dictionary suggestions. Custom replacements take precedence over built-in mappings, preserve source-word casing, and keep the delimiter that triggered inline replacement.

The default persisted file is:

```text
~/.omp/agent/spellcheck-words.json
```

The command respects `PI_CODING_AGENT_DIR`, so tests and scripts can use an isolated agent directory without mutating the real profile.

### Guardrails

Corrections are intentionally suppressed for code-ish and exact-text contexts, including:

- URLs
- paths
- identifiers / camelCase tokens
- slash-command contexts
- `@file` references
- property access / call-expression-looking text

## Settings

Active setting in `packages/coding-agent/src/config/settings-schema.ts`:

```yaml
spellcheckAutoReplace: true
```

- `spellcheckAutoReplace`: enables safe whole-word typo replacement after a delimiter.

## Files changed

- `packages/coding-agent/src/modes/spellcheck-autocomplete.ts` - dictionary typo map, dictionary-backed inline auto-replacement, learned-word/custom-replacement integration, user-reported typo mappings, natural-language hyphen correction, and guardrails.
- `packages/coding-agent/src/modes/spellcheck-user-words.ts` - persisted local ignored-word and replacement storage for `~/.omp/agent/spellcheck-words.json`.
- `packages/coding-agent/src/commands/spellcheck.ts` - `omp spellcheck` maintenance command for learn/unlearn/replace/forget/list/path.
- `packages/coding-agent/src/cli-commands.ts` - registers the `spellcheck` command.
- `packages/coding-agent/src/modes/spellcheck-dictionary-en-au.generated.ts` - embedded AU Hunspell dictionary data generated from `dictionary-en-au@3.0.0` for compiled-binary compatibility.
- `packages/coding-agent/package.json` / `bun.lock` - add `nspell@2.1.5`, `dictionary-en-au@3.0.0`, and the `is-buffer` transitive dependency.
- `packages/coding-agent/src/modes/prompt-action-autocomplete.ts` - wires spellcheck inline replacements into the existing prompt autocomplete provider without returning spellcheck suggestions.
- `packages/coding-agent/src/config/settings-schema.ts` - keeps `spellcheckAutoReplace` and removes the obsolete spellcheck suggestion setting.
- `packages/tui/src/components/editor.ts` - no longer auto-triggers autocomplete for normal alphabetic word tokens; runs inline replacement for mobile/composed single-line printable chunks.
- `packages/coding-agent/test/spellcheck-autocomplete.test.ts` - focused behavior tests for inline replacement, dictionary-backed corrections, learned ignored words/custom replacements, user-reported phrase correction, spellcheck quality sentence correction, natural-language hyphen correction, guardrails, and explicit option gates.
- `packages/coding-agent/test/spellcheck-user-words.test.ts` - focused persistence tests for learned ignored words and custom replacement storage.
- `packages/tui/test/editor-autocomplete-actions.test.ts` - regression coverage proving plain-word spellcheck replacement does not open the dropdown and multi-character printable chunks still run inline replacement.

## Verification performed

From `~/.omp/wt/oh-my-pi-skill-autocomplete`:

```bash
bun test packages/coding-agent/test/spellcheck-autocomplete.test.ts packages/coding-agent/test/spellcheck-user-words.test.ts packages/coding-agent/test/prompt-action-autocomplete.test.ts packages/tui/test/autocomplete.test.ts packages/tui/test/editor-autocomplete-actions.test.ts
```

Result:

```text
100 pass
0 fail
264 expect() calls
```

Focused regression files for the mobile/composed-input repair:

```bash
bun test packages/tui/test/editor-autocomplete-actions.test.ts packages/coding-agent/test/spellcheck-autocomplete.test.ts
```

Result:

```text
39 pass
0 fail
128 expect() calls
```

Focused spellcheck file after quality pass:

```text
17 pass
0 fail
75 expect() calls
```

```bash
bun --cwd=packages/coding-agent run check
bun --cwd=packages/tui run check
```

Results:

```text
bun check: passed
root biome: ok
```

Source, built, and active CLI checks with isolated `PI_CODING_AGENT_DIR` temp stores verified:

```bash
omp spellcheck learn cmux
omp spellcheck replace autocorrel autocorrect
omp spellcheck list
```

Observed persisted store:

```json
{
	"ignoredWords": ["cmux"],
	"replacements": {
		"autocorrel": "autocorrect"
	}
}
```

Built binary:

```bash
bun --cwd=packages/coding-agent run build
```

Verified built binary:

```bash
packages/coding-agent/dist/omp --version
packages/coding-agent/dist/omp -p --no-tools "Reply exactly OK"
```

Results:

```text
omp/16.3.9
OK
```

Installed active binary and verified:

```bash
omp --version
omp -p --no-tools "Reply exactly OK"
```

Results:

```text
omp/16.3.9
OK
```

Note: the smoke test printed the existing non-fatal extension warning:

```text
Extension error (~/.omp/agent/extensions/annotation-bridge.js): Failed to start server. Is port 47890 in use?
```

The command still returned `OK`.

## Implementation notes

The implementation deliberately avoids LLM-backed per-keystroke prediction. It uses local deterministic matching only, so it remains fast, private, and testable. Inline auto-replace now combines learned ignored words, custom user replacements, explicit high-confidence replacements, and `nspell` suggestions from an embedded Australian English Hunspell dictionary. Broad autocomplete suggestions for plain English words remain removed to avoid dropdown clutter. Ambiguous AU spelling is guarded: for example, `set color ` is not auto-rewritten to `colon` even though the AU dictionary prefers `colour`. Suggestion ranking deliberately prefers safe common prompt words found anywhere in the `nspell` suggestion list over unsafe first suggestions; this fixes cases such as `exactkt -> exactly` and `whye -> why`.
