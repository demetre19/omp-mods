# --- Fuzzy filesystem navigation (omp-mods/terminal-nav) ---
# Requires: zoxide, fzf, fd, broot (eza optional, for prettier previews).

# Keep bulk-seeded dirs (zseed -r) from self-evicting: zoxide's default
# _ZO_MAXAGE is 10k total rank, so thousands of rank-1 seeds evict each other.
export _ZO_MAXAGE=200000

# cd = smart jump to a known dir, cdi = interactive picker over the same db.
# zoxide only knows dirs you have visited or seeded — run `zseed -r ~` once.
if command -v zoxide >/dev/null 2>&1; then
  eval "$(zoxide init zsh --cmd cd)"
fi

# fzf ALT-C: fuzzy-pick any directory under cwd -> cd. fd is fast and skips junk.
if command -v fd >/dev/null 2>&1; then
  export FZF_ALT_C_COMMAND='fd --type d --hidden --exclude .git --exclude node_modules'
  export FZF_ALT_C_OPTS='--preview "eza --tree --level=1 --color=always {} 2>/dev/null || ls -la {}"'
fi

# cdf [root] [query]: fuzzy-pick ANY subdirectory (live filesystem, not just
# visited dirs). First arg is the search root only if it's an existing dir.
# One match = instant jump. Examples: `cdf kal`, `cdf ~ proj`, `cdf . "My Dir"`
cdf() {
  local root="."
  if [[ -d "${1:-}" ]]; then root="$1"; shift; fi
  local dir
  dir=$(fd --type d --hidden --exclude .git --exclude node_modules . "$root" 2>/dev/null \
    | fzf --prompt='cd> ' --query="${*:-}" --select-1 --exit-0 \
          --preview 'eza --tree --level=1 --color=always {} 2>/dev/null || ls -la {}') || return
  [[ -n "$dir" ]] && cd "$dir"
}

# zseed [-r] [dir]: add dirs to zoxide's db so `cd`/`cdi` know them.
#   zseed ~/Documents/Projects   # root + direct children
#   zseed -r ~                   # recursive — whole home folder
# fd excludes keep .git/node_modules/Library/etc. out of the db.
zseed() {
  local recursive=0
  if [[ "${1:-}" == "-r" || "${1:-}" == "--recursive" ]]; then
    recursive=1
    shift
  fi
  local root="${1:-$PWD}"
  root="${root/#\~/$HOME}"
  if [[ ! -d "$root" ]]; then
    print -u2 "zseed: not a directory: $root"
    return 1
  fi
  local count=0
  if command -v fd >/dev/null 2>&1; then
    local -a fd_args=(--type d --hidden
      --exclude .git --exclude node_modules --exclude .next
      --exclude .gradle --exclude __pycache__ --exclude .idea
      --exclude .prd-runs --exclude dist --exclude build --exclude Library)
    (( recursive )) || fd_args+=(--max-depth 1)
    while IFS= read -r dir; do
      zoxide add "$dir" >/dev/null 2>&1 && (( count++ ))
    done < <(fd "${fd_args[@]}" . "$root" 2>/dev/null; print -r -- "$root")
  else
    # Fallback without fd: root + direct children only (or slow rglob).
    python3 - "$recursive" "$root" <<'PY' | while IFS= read -r dir; do
import sys
from pathlib import Path
recursive = sys.argv[1] == "1"
root = Path(sys.argv[2]).expanduser().resolve()
print(root)
if recursive:
    for path in root.rglob("*"):
        if path.is_dir():
            print(path)
else:
    for path in root.iterdir():
        if path.is_dir():
            print(path)
PY
      zoxide add "$dir" >/dev/null 2>&1 && (( count++ ))
    done
  fi
  print "zseed: seeded $count folder(s) into zoxide from $root"
}

# br: broot tree navigator — arrows move, typing filters live, Option-Enter
# (or :cd + Enter) quits and lands the shell in the selected dir, Ctrl-C quits.
[ -r "$HOME/.config/broot/launcher/bash/br" ] && source "$HOME/.config/broot/launcher/bash/br"
