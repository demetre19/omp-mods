---
name: session-summary
description: "Use when the user types \"s.\" (or \"s\" alone), or asks for a summary, status, or overview of the current session/run — what it is doing, progress so far, and what needs attention. Summarizes the live OMP session transcript with the cheap mercury-2.5 model."
---

# Session Summary ("s.")

Summarize the current OMP session using the cheap `mercury-2.5` model (Inception Labs, OpenAI-compatible). The script locates **this tab's** live session transcript, condenses it, and returns an overview: goal, current state, what needs attention, next steps.

## Run

```bash
python3 ~/.omp/agent/managed-skills/session-summary/summarize.py
```

- Run it via `bash` exactly as above. It resolves **this tab's** session: finds the owning `omp` process (`ORCA_PI_STATUS_OWNED`, else the parent chain) and reads the `.jsonl` that process holds open via `lsof` — so it summarizes the tab you typed `s.` in, even when several tabs share a directory. Falls back to newest-file-matching-cwd if the process can't be identified.
- Optional: `python3 .../summarize.py --file <path.jsonl>` to summarize a specific session file, or `--chars 80000` to change the transcript budget.

## Present

Relay the script's stdout to the user verbatim — it is already formatted markdown. If the script prints an error (missing key file, no session found, API failure), show the error and stop; do not fabricate a summary.
