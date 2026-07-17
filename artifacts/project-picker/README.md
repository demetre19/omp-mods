# OMP project picker artifact

A portable copy of the files behind the numbered `ompp` terminal picker and in-session `/ompp` command.

## Included files

```text
bin/ompp                         Shell entry point
bin/cmux-omp-project             Start OMP in a selected project
bin/cmux-omp-resume              Resume OMP in a selected project
bin/cmux-omp-worktree            Create a worktree and start OMP
bin/cmux_project_lib.py          Shared project picker logic
config/projects.json             Sample project registry
extension/ompp-project-switcher.js  In-session /ompp command
skill/SKILL.md                   OMP skill instructions
```

## Install

1. Replace every sample name and `__HOME__` path in `config/projects.json` with an absolute path to a real folder. Do not copy the placeholder unchanged.
2. Copy the files:

```bash
mkdir -p ~/.config/cmux/bin ~/.omp/agent/extensions ~/.omp/agent/custom-skills/ompp-project-picker ~/.local/bin
cp config/projects.json ~/.config/cmux/projects.json
cp bin/cmux-* bin/cmux_project_lib.py ~/.config/cmux/bin/
cp bin/ompp ~/.local/bin/ompp
cp extension/ompp-project-switcher.js ~/.omp/agent/extensions/
cp skill/SKILL.md ~/.omp/agent/custom-skills/ompp-project-picker/SKILL.md
chmod +x ~/.local/bin/ompp ~/.config/cmux/bin/cmux-omp-project ~/.config/cmux/bin/cmux-omp-resume ~/.config/cmux/bin/cmux-omp-worktree
```

3. Add the extension to `~/.omp/agent/config.yml` using the configuration format supported by the installed OMP version.
4. Ensure `~/.local/bin` is on `PATH`.
5. Restart OMP so it loads the extension.

## Verify

```bash
ompp
node -e "import(process.env.HOME + '/.omp/agent/extensions/ompp-project-switcher.js').then(() => console.log('ok'))"
```

Inside OMP:

```text
/ompp
/ompp 1
/ompp Example
```

This artifact uses CMUX's project registry and launcher helpers, but the `/ompp` extension itself runs inside OMP.
