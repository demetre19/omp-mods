# session-summary — `s.` skill

A global OMP skill that summarizes the **current tab's** session on demand. Type `s.` (or "s", "summary", "status") and the agent runs `summarize.py`, which returns a markdown brief: **Goal / Status / Done / Needs attention / Next**.

## How it works

1. **Tab resolution** — finds the `omp` process that owns the tab (`ORCA_PI_STATUS_OWNED`, else the parent chain) and reads the session `.jsonl` that process holds open via `lsof`. This means `s.` always summarizes the tab you typed it in, even when several OMP tabs share a working directory. Falls back to newest-file-matching-`cwd` if the process can't be identified.
2. **Condense** — renders the JSONL as a compact transcript (user messages, agent text, tool calls + results with error flags), keeping the original ask plus the most recent ~60k chars.
3. **Summarize** — POSTs to Inception Labs `mercury-2.5` (a diffusion LLM — one of the fastest generators available) with `reasoning_effort: "low"` for ~1.5–2.5s responses.

## Install

```bash
mkdir -p ~/.omp/agent/managed-skills/session-summary
cp SKILL.md summarize.py ~/.omp/agent/managed-skills/session-summary/
```

Or copy into `~/.omp/agent/skills/session-summary/` for a user-authored skill, or `.omp/skills/session-summary/` for project-only.

## API key

The script needs an [Inception Labs](https://inceptionlabs.ai) key, resolved in this order:

1. `MERCURY_API_KEY` environment variable
2. First `sk_…` line in `~/.config/mercury/api_key` (override path with `MERCURY_KEY_FILE`)

```bash
mkdir -p ~/.config/mercury
echo "sk_your_key_here" > ~/.config/mercury/api_key
```

## Usage

```bash
python3 ~/.omp/agent/managed-skills/session-summary/summarize.py
# options:
#   --file <path.jsonl>   summarize a specific session file
#   --chars 80000         change the transcript budget (default 60000)
```

Restart OMP after installing — skills load at process start.

## Notes

- macOS/Linux only (uses `lsof` and `ps`). The `cwd` fallback works anywhere.
- `mercury-2.5` is a reasoning model; `reasoning_effort: "low"` roughly halves latency vs default while keeping a useful brief. Raise it for deeper summaries.
- No keys or personal paths are embedded — the key is read from env or a config file at runtime.
