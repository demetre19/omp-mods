#!/usr/bin/env python3
"""Summarize the current OMP session transcript with mercury-2.5 (Inception Labs).

Finds this tab's session .jsonl (the file the owning omp process holds open),
condenses it to a readable transcript, and asks mercury-2.5 for a status brief.
"""
import argparse
import glob
import json
import os
import re
import subprocess
import sys
import urllib.request

SESSIONS_ROOT = os.path.realpath(os.path.expanduser("~/.omp/agent/sessions"))
KEY_FILE = os.path.expanduser(
    os.environ.get("MERCURY_KEY_FILE", "~/.config/mercury/api_key")
)
API_URL = "https://api.inceptionlabs.ai/v1/chat/completions"
MODEL = "mercury-2.5"

PROMPT = """You are summarizing a live AI coding-agent (OMP) session transcript for the user, who asked for a quick status overview.

Produce a tight markdown brief with these sections (omit a section only if truly empty):

**Goal** — one or two sentences on what the user asked for.
**Status** — where the run is right now: what was just done / is in progress.
**Done** — short bullet list of concrete completed work (files changed, commands verified).
**Needs attention** — blockers, errors, open questions, decisions waiting on the user, anything risky.
**Next** — the immediate next step(s).

Rules: be concrete (name files, tools, errors); keep it under ~250 words; no preamble, no "here is the summary". The transcript may be truncated — summarize what is there, newest entries matter most.
"""


def read_key():
    key = os.environ.get("MERCURY_API_KEY", "").strip()
    if key:
        return key
    try:
        with open(KEY_FILE) as f:
            for line in f:
                line = line.strip()
                if line.startswith("sk_"):
                    return line
    except OSError:
        pass
    sys.exit(
        "error: no Mercury API key. Set MERCURY_API_KEY, or put an sk_… key in "
        f"{KEY_FILE} (override path with MERCURY_KEY_FILE)."
    )


def session_cwd(path):
    """Return the cwd recorded in the file's session header, or None."""
    try:
        with open(path) as f:
            for line in f:
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if rec.get("type") == "session":
                    return rec.get("cwd")
    except OSError:
        pass
    return None


def omp_pid():
    """PID of the omp process that owns this tab.

    ORCA_PI_STATUS_OWNED is set by the Orca status wrapper; otherwise walk the
    parent chain (tool commands run as direct children of the tab's omp).
    """
    owned = os.environ.get("ORCA_PI_STATUS_OWNED")
    if owned and owned.isdigit():
        return int(owned)
    pid = os.getppid()
    for _ in range(8):
        try:
            out = subprocess.check_output(
                ["ps", "-o", "ppid=,comm=", "-p", str(pid)], text=True
            ).split()
        except Exception:
            break
        if not out:
            break
        ppid, comm = int(out[0]), out[1]
        if os.path.basename(comm) == "omp":
            return pid
        pid = ppid
    return None


def find_session_file():
    """This tab's session file: the .jsonl our owning omp process holds open."""
    pid = omp_pid()
    if pid:
        try:
            out = subprocess.check_output(["lsof", "-p", str(pid)], text=True)
            for line in out.splitlines():
                m = re.search(r"(/\S+\.jsonl)\s*$", line)
                if m and SESSIONS_ROOT.split("/agent/")[0] in m.group(1):
                    return m.group(1)
        except Exception:
            pass
    # Fallback: newest .jsonl whose recorded cwd == current working directory.
    cwd = os.path.realpath(os.getcwd())
    candidates = sorted(
        glob.glob(os.path.join(SESSIONS_ROOT, "*", "*.jsonl")),
        key=os.path.getmtime,
        reverse=True,
    )
    for path in candidates[:40]:
        rec_cwd = session_cwd(path)
        if rec_cwd and os.path.realpath(rec_cwd) == cwd:
            return path
    sys.exit(f"error: no session transcript found for this tab under {SESSIONS_ROOT}")


def clip(text, n):
    text = text.strip()
    return text if len(text) <= n else text[:n] + f"…[+{len(text) - n} chars]"


def condense(path, budget):
    """Render the JSONL as a compact transcript, most recent entries kept."""
    lines = []
    with open(path) as f:
        for raw in f:
            try:
                rec = json.loads(raw)
            except json.JSONDecodeError:
                continue
            t = rec.get("type")
            if t == "message":
                msg = rec.get("message", {})
                role = msg.get("role", "?")
                for part in msg.get("content") or []:
                    pt = part.get("type")
                    if pt == "text" and part.get("text"):
                        tag = {"user": "USER", "assistant": "AGENT"}.get(role, role.upper())
                        lines.append(f"{tag}: {clip(part['text'], 2000)}")
                    elif pt == "toolCall":
                        args = json.dumps(part.get("arguments") or {})
                        lines.append(
                            f"AGENT → tool {part.get('name')}({clip(args, 400)})"
                        )
                if role == "toolResult":
                    for part in msg.get("content") or []:
                        if part.get("type") == "text" and part.get("text"):
                            err = " [ERROR]" if msg.get("isError") else ""
                            lines.append(
                                f"TOOL {msg.get('toolName')}{err}: {clip(part['text'], 800)}"
                            )
            elif t == "model_change":
                lines.append(f"[model → {rec.get('model')}]")
    # Keep the first user message (the ask) plus as much tail as fits.
    head, tail = [], []
    for i, l in enumerate(lines):
        if l.startswith("USER:"):
            head.append(l)
            lines = lines[i + 1 :]
            break
    total = 0
    for l in reversed(lines):
        total += len(l) + 1
        if total > budget:
            break
        tail.append(l)
    tail.reverse()
    if len(tail) < len(lines):
        tail.insert(0, f"[…{len(lines) - len(tail) + 1} earlier entries omitted…]")
    return "\n".join(head + tail)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", help="explicit session .jsonl path")
    ap.add_argument("--chars", type=int, default=60000, help="transcript char budget")
    args = ap.parse_args()

    path = args.file or find_session_file()
    transcript = condense(path, args.chars)
    if not transcript.strip():
        sys.exit(f"error: transcript in {path} is empty")

    payload = json.dumps(
        {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": PROMPT},
                {"role": "user", "content": transcript},
            ],
            "temperature": 0.2,
            "reasoning_effort": "low",  # ~2x faster; still enough reasoning for a brief
            "max_tokens": 4000,  # mercury-2.5 reasons; leave headroom
        }
    ).encode()

    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {read_key()}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            body = json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"error: API {e.code}: {e.read()[:400].decode(errors='replace')}")
    except Exception as e:
        sys.exit(f"error: {e}")

    try:
        print(body["choices"][0]["message"]["content"].strip())
    except (KeyError, IndexError):
        sys.exit(f"error: unexpected API response: {json.dumps(body)[:400]}")


if __name__ == "__main__":
    main()
