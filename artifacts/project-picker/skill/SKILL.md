---
name: ompp-project-picker
description: Use when the user asks about the OMP/CMUX numbered project picker, the `ompp` terminal command, or switching OMP projects from inside an existing session with `/ompp`.
---

# OMPP Project Picker

Use this skill when working on the global OMP project picker setup.

## What exists

Terminal command:

```bash
ompp
```

Permanent executable wrapper:

```text
~/.local/bin/ompp
```

Wrapper contents:

```bash
#!/usr/bin/env bash
exec ~/.config/cmux/bin/cmux-omp-project --pick "$@"
```

Project registry:

```text
~/.config/cmux/projects.json
```

CMUX launcher scripts:

```text
~/.config/cmux/bin/cmux-omp-project
~/.config/cmux/bin/cmux-omp-resume
~/.config/cmux/bin/cmux-omp-worktree
~/.config/cmux/bin/cmux_project_lib.py
```

In-session OMP slash command extension:

```text
~/.omp/agent/extensions/ompp-project-switcher.js
```

OMP config enabling the extension and this skill directory:

```text
~/.omp/agent/config.yml
```

Documentation:

```text
docs/project-picker.md in the `omp-mods` repository
```

## User-facing behavior

From a normal terminal:

```bash
ompp
```

This opens a numbered list of saved projects. Typing a number launches OMP in that project with `omp --cwd <project>`.

Inside an existing OMP session:

```text
/ompp
/ompp 1
/ompp Example
```

`/ompp` lists projects. `/ompp <number|name|path>` switches the current OMP session to the matching project.

## Maintenance rules

- Keep `~/.local/bin` on PATH globally for shell command availability.
- Keep the executable wrapper, not only a shell alias. Aliases are shell-specific and do not work everywhere.
- If `/ompp` is not recognized inside OMP, restart OMP. Extensions load at session startup.
- Update `~/.config/cmux/projects.json` to change the numbered project list.
- Only include real directories in `projects.json`; invalid paths are skipped by the launcher.

## Verification

```bash
zsh -lc 'command -v ompp && type -a ompp'
bash -lc 'command -v ompp && type -a ompp'
node -e "import('~/.omp/agent/extensions/ompp-project-switcher.js').then(()=>console.log('ok'))"
omp config get extensions
```

Expected command path:

```text
~/.local/bin/ompp
```

Expected extension config includes:

```text
~/.omp/agent/extensions/ompp-project-switcher.js
```
