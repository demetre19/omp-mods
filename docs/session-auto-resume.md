# Session auto-resume — restart OMP in place when a session ends

A zsh shell wrapper that re-enters the last OMP session in the current pane a few
seconds after `omp` exits. Quit, interrupt, or crash an interactive session and the
pane waits ~3s, then relaunches `omp --continue` scoped to that directory's most
recent session. Press any key during the window to stay in the shell instead.

It is a shell function, not a binary patch — no rebuild, no OMP source changes, and it
survives OMP updates.

## What you get

- **Automatic re-entry.** When an interactive `omp` session ends, the pane offers to
  resume it (`omp --continue`) after a 3-second countdown. cwd-scoped: it resumes the
  session for the directory you are in, not the global newest.
- **Escape hatch.** Press any key during the countdown to stay in the shell.
- **Crash guard.** If a (re)launched session exits in under 8 seconds twice in a row,
  the wrapper stops looping and leaves you in the shell.
- **Zero interference with automation.** The wrapper bypasses itself (runs plain
  `command omp`) for every non-interactive or managed path, so scripts, PRD lanes,
  crew workers, and one-shot prompts are never trapped in a resume loop.

## Install

```sh
mkdir -p ~/.omp/agent/shell
curl -fsSL https://raw.githubusercontent.com/demetre19/omp-mods/main/artifacts/autoresume/omp-autoresume.zsh \
  -o ~/.omp/agent/shell/omp-autoresume.zsh
```

Then source it from the interactive block of your `~/.zshrc` (after any OMP
completions file):

```zsh
# ~/.zshrc — interactive shells only
[[ -o interactive ]] && source ~/.omp/agent/shell/omp-autoresume.zsh
```

Open a new shell (or `source ~/.zshrc`) to activate. To uninstall, remove the source
line and delete the file.

## How it works

The file defines an `omp()` zsh function that wraps the real `omp` binary. On each
call it decides whether to pass through untouched or to run a resume loop:

1. **Bypass check.** If the call is non-interactive or managed, it runs
   `command omp "$@"` immediately and returns.
2. **Argument scan.** It strips any user-supplied resume flags (`-c`/`--continue`,
   `-r`/`--resume`, `--resume=…`) so it can add its own `--continue` cleanly, and
   detects flags that must bypass the loop entirely.
3. **Resume loop.** It runs `omp`, and when that process exits it re-arms with
   `--continue` plus the stripped args, waits 3s for a keypress, and relaunches unless
   you interrupt.

### When it bypasses (runs plain `command omp`)

- `OMP_NO_AUTORESUME` is set.
- stdin or stdout is not a TTY (scripts, pipelines, tool calls).
- `OMP_PROFILE` is set or `--profile` is passed — covers PRD lanes, which run
  `omp --profile prd-lane`.
- `AUTONOMY_RUN_DIR` / `AUTONOMY_LANE_ID` / `AUTONOMY_ENGINE` are present — covers
  crew/PRD spawned workers via `autonomy_crew.launch_env`.
- `OTEL_RESOURCE_ATTRIBUTES` carries `prd.*` lane identity.
- Any positional arg is given (subcommand, initial prompt, `@file`).
- An exit-only flag is given: `-p`/`--print`, `--mode`, `--export`, `--alias`,
  `--help`, `--version`, `--no-session`, `--from-claude`, `--from-codex`.
- `command omp …` always bypasses the wrapper by definition.

## Notes and limits

- **zsh only.** The wrapper uses zsh specifics (`read -k`, `SECONDS`, `print -r`).
  Bash would need a port.
- **Interactive shells only.** Source it inside an `[[ -o interactive ]]` guard so
  non-interactive shells and scripts are unaffected.
- **Per-pane.** Each terminal pane gets its own resume behavior; closing one pane's
  session does not affect others.
- **Opt out per call.** Prefix with `command` (`command omp …`) or set
  `OMP_NO_AUTORESUME=1` for a single shell.

## Verification

- Launch `omp` interactively, quit, and confirm the pane waits ~3s then re-enters the
  same directory's session.
- Press a key during the countdown and confirm you stay in the shell.
- Run `omp -p "hi"` and `omp --profile prd-lane` and confirm neither loops.
- Kill a session so it exits in under 8s twice; confirm the wrapper stops and prints
  the stay-in-shell message.
