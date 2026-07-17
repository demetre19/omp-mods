#!/usr/bin/env python3
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

CONFIG_DIR = Path.home() / ".config" / "cmux"
PROJECTS_FILE = CONFIG_DIR / "projects.json"
HOME = str(Path.home())
TEMP_ROOTS = ("/tmp", "/private/tmp", "/var/folders")

def load_projects():
    try:
        data = json.loads(PROJECTS_FILE.read_text())
    except Exception:
        return []
    projects = []
    for item in data.get("projects", []):
        path = item.get("path", "")
        name = item.get("name", Path(path).name if path else "")
        if path and Path(path).is_dir():
            projects.append({"name": name, "path": str(Path(path).expanduser())})
    return projects

def git_root(path):
    try:
        out = subprocess.check_output(["git", "-C", path, "rev-parse", "--show-toplevel"], text=True, stderr=subprocess.DEVNULL)
        root = out.strip()
        return root if root else None
    except Exception:
        return None

def sane_cwd(path):
    path = str(Path(path).resolve())
    if path == HOME:
        return False
    if path.startswith(TEMP_ROOTS):
        return False
    return Path(path).is_dir()

def match_project(token, projects):
    if not token:
        return None
    expanded = str(Path(token).expanduser())
    if Path(expanded).is_dir():
        return {"name": Path(expanded).name, "path": str(Path(expanded).resolve())}
    needle = token.lower()
    for project in projects:
        if needle == project["name"].lower() or needle == project["path"].lower():
            return project
    matches = [p for p in projects if needle in p["name"].lower() or needle in p["path"].lower()]
    return matches[0] if len(matches) == 1 else None

def choose_project(projects):
    if not sys.stdin.isatty():
        if projects:
            return projects[0]
        raise SystemExit("No project registry entries available.")
    print("Select a project:")
    for idx, project in enumerate(projects, 1):
        print(f"{idx:2d}. {project['name']}  {project['path']}")
    print("")
    choice = input("Project number, path, or search text: ").strip()
    if not choice:
        raise SystemExit("No project selected.")
    if choice.isdigit():
        pos = int(choice) - 1
        if 0 <= pos < len(projects):
            return projects[pos]
        raise SystemExit(f"Project number out of range: {choice}")
    selected = match_project(choice, projects)
    if selected:
        return selected
    raise SystemExit(f"No unique project match for: {choice}")

def resolve_project(force_pick=False, explicit=None):
    projects = load_projects()
    if explicit:
        selected = match_project(explicit, projects)
        if selected:
            return selected
        raise SystemExit(f"Unknown project: {explicit}")
    cwd = str(Path.cwd().resolve())
    if not force_pick and sane_cwd(cwd):
        root = git_root(cwd) or cwd
        for project in projects:
            try:
                Path(cwd).relative_to(Path(project["path"]))
                return project
            except ValueError:
                pass
        return {"name": Path(root).name, "path": root}
    return choose_project(projects)

def set_cmux_titles(workspace_title, tab_title=None):
    cmux = shutil.which("cmux")
    if not cmux:
        return
    env = os.environ.copy()
    workspace_id = env.get("CMUX_WORKSPACE_ID")
    tab_id = env.get("CMUX_TAB_ID") or env.get("CMUX_SURFACE_ID")
    try:
        if workspace_id and workspace_title:
            subprocess.run(
                [cmux, "workspace", "rename", workspace_id, "--title", workspace_title],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
                env=env,
            )
        if tab_id and tab_title:
            subprocess.run(
                [cmux, "rename-tab", "--tab", tab_id, "--title", tab_title],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
                env=env,
            )
    except Exception:
        return

def project_title(project, suffix=""):
    name = project.get("name") or Path(project.get("path", "")).name
    return f"{name}{suffix}"


def exec_omp(project, args=None, resume=False):
    args = args or []
    path = project["path"]
    workspace_title = project_title(project, " Resume" if resume else "")
    tab_title = workspace_title
    set_cmux_titles(workspace_title, tab_title)
    os.chdir(path)
    cmd = ["omp", "--cwd", path]
    if resume:
        cmd.append("--resume")
    cmd.extend(args)
    os.execvp(cmd[0], cmd)

def exec_shell(project):
    path = project["path"]
    workspace_title = project_title(project, " Shell")
    set_cmux_titles(workspace_title, workspace_title)
    os.chdir(path)
    shell = os.environ.get("SHELL") or "/bin/zsh"
    os.execvp(shell, [shell, "-l"])

def create_worktree(project):
    source = git_root(project["path"])
    if not source:
        raise SystemExit(f"Project is not inside a Git repository: {project['path']}")
    git = shutil.which("git") or "git"
    repo_name = Path(source).name
    stamp = subprocess.check_output(["date", "+%Y%m%d-%H%M%S"], text=True).strip()
    head = subprocess.check_output([git, "-C", source, "rev-parse", "--short", "HEAD"], text=True).strip()
    target_root = Path.home() / ".omp" / "wt" / "cmux" / repo_name
    target = target_root / f"{repo_name}-{stamp}-{head}"
    target_root.mkdir(parents=True, exist_ok=True)
    subprocess.check_call([git, "-C", source, "worktree", "add", "--detach", str(target), "HEAD"])
    include = Path(source) / ".worktreeinclude"
    if include.exists():
        for raw in include.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            src = Path(source) / line
            dst = target / line
            if src.is_file() and not dst.exists():
                dst.parent.mkdir(parents=True, exist_ok=True)
                dst.write_bytes(src.read_bytes())
    override = Path(source) / "AGENTS.override.md"
    if override.is_file():
        dst = target / "AGENTS.override.md"
        if not dst.exists():
            dst.write_bytes(override.read_bytes())
    return {"name": f"{project['name']} worktree", "path": str(target), "source": source}

def parse_common(argv):
    force_pick = "--pick" in argv
    explicit = None
    rest = []
    skip = False
    for i, arg in enumerate(argv):
        if skip:
            skip = False
            continue
        if arg in ("--pick", "--here"):
            continue
        if arg == "--path" and i + 1 < len(argv):
            explicit = argv[i + 1]
            skip = True
            continue
        rest.append(arg)
    return force_pick, explicit, rest
