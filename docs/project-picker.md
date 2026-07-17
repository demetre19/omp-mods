# OMP Project Picker (`ompp`)

This documents the terminal project picker and the in-session `/ompp` command that use the same numbered CMUX project list.

## What it does

Run:

```bash
ompp
```

It shows a numbered list like:

```text
Select a project:
 1. Example Project  ~/Projects/Example Project
 2. Another Project     ~/Projects/Another Project
 3. Third Project       ~/Projects/Third Project

Project number, path, or search text:
```

Typing `1` starts OMP in the first project.

Inside an existing OMP session, run:

```text
/ompp
```

That lists the same projects. Then run:

```text
/ompp 1
```

That switches the current OMP session to project 1.

## Files involved

Project registry:

```text
~/.config/cmux/projects.json
```

Launcher scripts:

```text
~/.config/cmux/bin/cmux-omp-project
~/.config/cmux/bin/cmux-omp-resume
~/.config/cmux/bin/cmux-omp-worktree
~/.config/cmux/bin/cmux_project_lib.py
```

In-session OMP extension:

```text
~/.omp/agent/extensions/ompp-project-switcher.js
```

OMP config enabling the extension and global skill directory:

```text
~/.omp/agent/config.yml
```

Global OMP skill:

```text
~/.omp/agent/custom-skills/ompp-project-picker/SKILL.md
```

Permanent shell command wrapper, global PATH setup, and optional zsh alias:

```text
~/.local/bin/ompp
~/.zshenv
~/.bash_profile
~/.zshrc
```

The executable wrapper is preferred because it works in `zsh`, `bash`, login shells, and non-alias contexts. `.zshenv` and `.bash_profile` keep `~/.local/bin` globally available. The `.zshrc` alias is only a convenience for interactive zsh.

```bash
alias ompp='~/.config/cmux/bin/cmux-omp-project --pick'
```

Wrapper file:

```bash
#!/usr/bin/env bash
exec ~/.config/cmux/bin/cmux-omp-project --pick "$@"
```

After adding or changing the in-session extension, restart the current OMP session once. OMP loads extension files at session startup, so an already-running session will not see `/ompp` until it is restarted.

## How it works

`cmux-omp-project --pick` loads:

```text
~/.config/cmux/projects.json
```

Then `cmux_project_lib.py` prints every project with a number. After selection it runs:

```bash
omp --cwd '<selected project path>'
```

So OMP starts with the correct project directory instead of `/tmp` or `$HOME`.

The in-session `/ompp` command is registered by `ompp-project-switcher.js`. It reads the same `projects.json`, accepts a number, name, or path, then moves the active OMP session to that project and reloads the session runtime.

The globally available OMP skill is registered through `skills.customDirectories` in `config.yml`:

```yaml
skills:
  customDirectories:
    - ~/.omp/agent/custom-skills
```

The skill file is:

```text
~/.omp/agent/custom-skills/ompp-project-picker/SKILL.md
```

## Related commands

Start a new OMP session from the picker:

```bash
ompp
```

Direct command without alias:

```bash
~/.config/cmux/bin/cmux-omp-project --pick
```

Resume OMP in a selected project:

```bash
~/.config/cmux/bin/cmux-omp-resume --pick
```

Create a git worktree for a selected project, then start OMP:

```bash
~/.config/cmux/bin/cmux-omp-worktree --pick
```

Inside an existing OMP session:

```text
/ompp
/ompp 1
/ompp Example
```

If `/ompp` is not recognized inside OMP, exit and start OMP again. The extension is loaded only during OMP startup.

## Updating the project list

Edit:

```text
~/.config/cmux/projects.json
```

Each entry has this shape:

```json
{
  "name": "Another Project",
  "path": "~/Projects/Another Project"
}
```

Only include folders that exist. The picker skips invalid paths.

## Verification

Check the alias is loaded:

```bash
zsh -ic 'alias ompp'
```

Expected output:

```text
ompp='~/.config/cmux/bin/cmux-omp-project --pick'
```

Check the executable is available in both zsh and bash:

```bash
zsh -ic 'type -a ompp'
bash -lc 'type -a ompp'
```

Expected output includes:

```text
ompp is ~/.local/bin/ompp
```

Check the global PATH setup:

```bash
zsh -lc 'command -v ompp && type -a ompp'
bash -lc 'command -v ompp && type -a ompp'
```

Open a new terminal tab and run:

```bash
ompp
```

Check the in-session extension imports cleanly:

```bash
node -e \"import('~/.omp/agent/extensions/ompp-project-switcher.js').then(()=>console.log('ok'))\"
```

Check OMP config includes the extension:

```bash
omp config get extensions
```

Expected output includes:

```text
~/.omp/agent/extensions/ompp-project-switcher.js
```

Check OMP config includes the custom global skill directory:

```bash
omp config get skills.customDirectories
```

Expected output:

```text
[\"~/.omp/agent/custom-skills\"]
```
