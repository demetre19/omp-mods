# SkillOpt for OMP and Codex with HoneyBadger storage

## System modified

- OMP / CMUX / both: OMP. Codex configuration and SkillOpt itself are also integrated; CMUX was not modified.
- Platform: macOS paths and shell configuration; the Python adapter is otherwise portable.
- CMUX required: no.

## Prerequisites

- OMP installed at `~/.local/bin/omp` and configured by `~/.omp/agent/config.yml`.
- Codex installed and configured by `~/.codex/config.toml`.
- Microsoft SkillOpt pinned checkout at `~/.local/share/SkillOpt`.
- Python 3.12 and `uv`; the global `skillopt-sleep` command is installed as a `uv tool`.
- External volume mounted at `/Volumes/ExternalDrive`.
- Existing OMP sessions under `~/.omp/agent/sessions`.
- Restart OMP and start a fresh Codex process after changing skill discovery or configuration.

## What this change does

SkillOpt is globally available to OMP and Codex, while its state and shared skills live on an external volume. SkillOpt can harvest native OMP JSONL sessions directly, scopes sessions by their recorded `session.cwd`, redacts user/assistant text, records tool names only, and excludes raw tool output, thinking blocks, and nested advisor transcripts.

The default transcript source is `omp`. Codex transcripts remain available through an explicit `--source codex` invocation. OMP and Codex discover the same external `skillopt-sleep` and `skillopt-sleep-learned` skills.

Codex runtime references for its notifier, Computer Use service, bundled marketplace, hook file, and Node REPL home/trusted path point to `/Volumes/ExternalDrive/CODEX Sessions/Home`. This does not replace `~/.codex` with a symlink; the separate guarded full-home migration script remains unexecuted.

## Why this change exists

OMP is the active client and uses Codex models, but OMP and Codex write different transcript formats. Upstream SkillOpt only harvested Claude/Codex transcripts, so selecting the Codex provider did not make OMP sessions harvestable. The adapter closes that format gap and keeps persistent SkillOpt/Codex data off the internal disk.

## Files to create or edit

- `~/.local/share/SkillOpt/skillopt_sleep/harvest_omp.py` - native OMP JSONL harvester.
- `~/.local/share/SkillOpt/skillopt_sleep/config.py` - `OMP_AGENT_DIR`, `omp_agent_dir`, and `omp_sessions_dir` configuration.
- `~/.local/share/SkillOpt/skillopt_sleep/harvest_sources.py` - OMP routing and OMP-first automatic source selection.
- `~/.local/share/SkillOpt/skillopt_sleep/__main__.py` - `omp` source choice and `--omp-agent-dir`.
- `~/.local/share/SkillOpt/tests/test_sleep_engine.py` - OMP harvest boundary/redaction tests.
- `/Volumes/ExternalDrive/AI-Agent-History/SkillOpt/config.json` - external state, homes, and default OMP source.
- `/Volumes/ExternalDrive/AI-Agent-History/SkillOpt/agent-home/skills/skillopt-sleep/SKILL.md` - shared driver skill.
- `/Volumes/ExternalDrive/AI-Agent-History/SkillOpt/agent-home/skills/skillopt-sleep-learned/SKILL.md` - shared learned skill.
- `~/.omp/agent/config.yml` - external SkillOpt skill directory.
- `~/.omp/agent/custom-skills/skillopt-sleep` - directory symlink to the shared driver skill.
- `~/.omp/agent/custom-skills/skillopt-sleep-learned` - directory symlink to the shared learned skill.
- `~/.codex/skills`, `~/.agents/skills`, `/Volumes/ExternalDrive/CODEX Sessions/Home/skills`, and `/Volumes/ExternalDrive/CODEX Sessions/.codex/skills` - `SKILL.md` symlinks to the shared skills.
- `~/.codex/config.toml` and `/Volumes/ExternalDrive/CODEX Sessions/Home/config.toml` - active and external Codex path alignment.
- `~/.codex/AGENTS.md`, `/Volumes/ExternalDrive/CODEX Sessions/Home/AGENTS.md`, and `/Volumes/ExternalDrive/CODEX Sessions/.codex/AGENTS.md` - global SkillOpt trigger and usage.
- `~/.zshrc` - SkillOpt checkout/Python and external `CODEX_HOME` exports.

## LLM recreation instructions

Give these instructions to an LLM:

1. Pin and inspect the desired Microsoft SkillOpt revision under `~/.local/share/SkillOpt`; install it with Python 3.12 using `uv tool install --force --no-cache --python /opt/homebrew/opt/python@3.12/bin/python3.12 ~/.local/share/SkillOpt`.
2. Add an OMP harvester that reads only main `sessions/*/*.jsonl` files, explicitly skips `__*.jsonl` and nested advisor directories, accepts only ordinary user/assistant messages, records tool-call names but not arguments/results, uses the transcript header's `cwd` for project scoping, and passes text through the existing Codex redactor.
3. Add `omp` to the source choices and route it through the source dispatcher. Make automatic selection prefer OMP when OMP sessions exist, then Codex, then Claude.
4. Create `/Volumes/ExternalDrive/AI-Agent-History/SkillOpt/config.json` with external state/shared-skill paths, `codex_home` set to `/Volumes/ExternalDrive/CODEX Sessions/Home`, `omp_agent_dir` set to `~/.omp/agent`, and `transcript_source` set to `omp`.
5. Replace `~/.skillopt-sleep` with a symlink to `/Volumes/ExternalDrive/AI-Agent-History/SkillOpt`, preserving any prior local state in a timestamped backup first.
6. Put the driver and learned skills under `/Volumes/ExternalDrive/AI-Agent-History/SkillOpt/agent-home/skills`, then link them into the OMP custom-skill directory and the local/external Codex skill roots.
7. Add the external shared-skill root to `skills.customDirectories` in `~/.omp/agent/config.yml` without removing existing directories.
8. Copy the active Codex notifier, Computer Use app, bundled marketplace cache, and `hooks.json` to matching paths below `/Volumes/ExternalDrive/CODEX Sessions/Home`, then repoint the corresponding active config values. Point Node REPL `CODEX_HOME` and trusted code paths at that external Home. Update the `[hooks.state."/Volumes/ExternalDrive/CODEX Sessions/Home/hooks.json:…"]` trust-state keys so they name the copied external hook file while preserving their verified hashes; parse the config and confirm that the file and all three hook entries match. Do not claim that the full home was migrated unless `~/.codex` itself was deliberately replaced after Codex was fully quit.
9. Export `CODEX_HOME=/Volumes/ExternalDrive/CODEX Sessions/Home` for fresh shell launches. Keep explicit Codex harvesting available as `skillopt-sleep harvest --source codex --codex-home '/Volumes/ExternalDrive/CODEX Sessions/Home'`.
10. Restart OMP and Codex so their skill/config catalogs reload.

## Verification

- Run the focused adapter tests: `cd ~/.local/share/SkillOpt && /opt/homebrew/bin/python3.12 -m unittest tests.test_sleep_engine.TestHarvest`. Expected result for this installation: 12 tests pass, with one environment-dependent skip.
- From a project on the external volume, run `skillopt-sleep harvest --lookback-hours 0 --max-sessions 5 --json`; verify `transcript_source` is `omp`, `project` is the exact current project path, and at least one scoped session/task is returned. Do not print harvested task text during verification.
- From the same project, run `CODEX_HOME='/Volumes/ExternalDrive/CODEX Sessions/Home' codex --version` and `~/.local/bin/omp --version`.
- Parse `~/.codex/config.toml` with Python `tomllib` and verify every repointed executable/directory exists.
- Use OMP's skill scanner or start a fresh OMP session and verify both `skillopt-sleep` and `skillopt-sleep-learned` are discovered without warnings.

## Notes for non-CMUX users

CMUX is not required. OMP and Codex users on macOS can reproduce the setup directly. Windows users must replace the Unix paths, symlinks, `.zshrc`, and mounted-volume assumptions with Windows equivalents; the OMP JSONL parsing rules still apply if their OMP session schema matches. Existing OMP/Codex sessions must be restarted after skill-discovery changes.