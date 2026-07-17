# OMP skill dropdown after typed text - what happened and how to reuse the fix

> Historical note: this records the first implementation, which replaced the whole draft. The newer [`mid-text-skill-autocomplete.md`](./mid-text-skill-autocomplete.md) behavior preserves surrounding prompt text and takes precedence where the two guides differ.

## Short version

OMP had a TUI autocomplete limitation: skill slash autocomplete only opened when `/` was typed at the very start of the submitted prompt. If a user typed normal text first and then typed `/skill:` or `/security`, no dropdown appeared.

This was fixed locally by patching OMP so a slash token typed after existing text opens a skills-only dropdown. Picking a skill replaces the whole draft with `/skill:<name> ` so OMP actually invokes the skill.

## Symptom

Working case:

```text
/security
```

or:

```text
/skill:deep-security-scan
```

When typed first, OMP showed the dropdown.

Broken case:

```text
there is an issue

/skill:
```

No dropdown appeared.

## Root cause

The OMP TUI editor only treated slash autocomplete as valid when all text before the cursor was whitespace. In practice, the guard was equivalent to:

```ts
previous lines must be blank
AND current text before cursor must start with "/"
```

So a multi-line prompt with prose above the slash was blocked before the autocomplete provider could return any skill suggestions.

This matched upstream Oh My Pi issue:

```text
can1357/oh-my-pi#3359
TUI: open skills autocomplete when typing / anywhere in the prompt (not just at line start)
```

## Design decision

Mid-text slash autocomplete should show skills only, not the full command palette.

Reason:

- Built-in slash commands like `/model` or `/compact` only make sense when the submitted prompt starts with the command.
- Skills are also invoked only when the final submitted prompt starts with `/skill:`.
- Therefore, when a user picks a skill from a mid-text dropdown, OMP must replace the draft with `/skill:<name> `.

This intentionally discards the draft text. That is safer than inserting `/skill:<name>` into the middle of prose, because mid-prose skill text would be submitted as plain text and would not invoke the skill.

## What was changed

Source checkout used:

```text
~/.omp/wt/oh-my-pi-skill-autocomplete
```

Active binary installed at:

```text
~/.local/bin/omp
```

Files changed in the OMP source tree:

```text
packages/tui/src/autocomplete.ts
packages/tui/src/components/editor.ts
packages/tui/test/autocomplete.test.ts
packages/tui/test/editor-autocomplete-actions.test.ts
packages/tui/CHANGELOG.md
```

## Implementation summary

`packages/tui/src/autocomplete.ts`:

- Added a trailing slash-token detector for text like:

```text
some prose /sec
```

- Added skills-only completion by filtering command entries whose name starts with:

```text
skill:
```

- Added apply behavior that replaces the full draft buffer with:

```text
/skill:<name>
```

The generated line ends with one literal space after the skill name.

`packages/tui/src/components/editor.ts`:

- Replaced the old “slash only at submitted prompt start” trigger with a slash-token context helper.
- The helper allows:
  - normal command palette at prompt start
  - skills-only slash token after existing text
- Updated Tab handling so `foo /sec<Tab>` triggers skill completion instead of file completion.
- Used the slash-command dropdown layout for mid-text slash skill suggestions.

## Verification performed

Targeted tests:

```bash
bun test packages/tui/test/autocomplete.test.ts packages/tui/test/editor-autocomplete-actions.test.ts
```

Result:

```text
48 pass
0 fail
```

Package check:

```bash
bun --cwd=packages/tui run check
```

Result:

```text
passed
```

Patched binary verification before install:

```bash
~/.omp/wt/oh-my-pi-skill-autocomplete/packages/coding-agent/dist/omp --version
~/.omp/wt/oh-my-pi-skill-autocomplete/packages/coding-agent/dist/omp -p --no-tools "Reply exactly OK"
```

Results:

```text
omp/16.2.0
OK
```

Active installed binary verification:

```bash
omp --version
omp -p --no-tools "Reply exactly OK"
```

Results:

```text
omp/16.2.0
OK
```

## Build notes for other users

Current OMP source requires Bun `>= 1.3.14`.

On this workstation, Bun was initially `1.2.18`, which failed because:

```text
Bun.Archive.write is missing
```

and the source CLI refused to run with:

```text
Bun runtime must be >= 1.3.14
```

Exact Bun install used:

```bash
curl -fsSL https://bun.com/install | bash -s "bun-v1.3.14"
```

Then:

```bash
bun install --frozen-lockfile --ignore-scripts
bun --cwd=packages/natives run build
bun test packages/tui/test/autocomplete.test.ts packages/tui/test/editor-autocomplete-actions.test.ts
bun --cwd=packages/tui run check
bun --cwd=packages/coding-agent run build
```

## Install notes for this workstation

The original active binary was backed up to:

```text
~/.local/bin/omp.backup-16.1.23-skill-autocomplete-20260627-125946
```

A direct copy of the new compiled binary over `~/.local/bin/omp` produced exit code `137` only at that exact path, even though the bytes matched and the same binary worked elsewhere.

Workaround used:

1. Copy the built binary to a new name under `~/.local/bin/`.
2. Verify the new name works.
3. Atomically rename the known-good copy into `~/.local/bin/omp`.

A stale killed copy was kept at:

```text
~/.local/bin/omp.stale-killed-copy-20260627-130100
```

## Global availability in future chats

This learning is also installed as a global skill named:

```text
omp-source-build-install
```

Installed locations:

```text
~/.omp/agent/custom-skills/omp-source-build-install/SKILL.md
~/.codex/skills/omp-source-build-install/SKILL.md
```

Use this skill trigger in future chats when patching OMP itself, rebuilding OMP, handling Bun/native-addon build issues, or replacing `~/.local/bin/omp`.

Existing OMP/Codex sessions may need a restart before the new skill appears in the skill registry.

## How another user can test the behavior

After restarting OMP, type:

```text
some existing text

/sec
```

Expected:

- A dropdown appears.
- It contains skill entries only.
- Selecting `skill:security-scan` or another skill replaces the prompt with:

```text
/skill:<selected-skill>
```

The generated line ends with one literal space after the selected skill name.

Then pressing Enter invokes the skill.

## Related technical note

A more implementation-focused recreation note also exists:

```text
./README-omp-mid-text-skill-autocomplete.md
```
