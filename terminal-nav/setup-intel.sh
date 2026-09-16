#!/bin/zsh
# terminal-nav setup — Intel Macs (brew prefix /usr/local)
# Installs brew if missing, then zoxide/fzf/fd/broot/eza, wires ~/.zshrc,
# and optionally seeds your home folder into zoxide. Safe to re-run.
#
# NOTE for old Intel Macs: if your macOS is too old for current Homebrew,
# bottles won't exist and tools compile from source (slow but works).
# `brew doctor` will tell you. If brew itself won't install, use MacPorts:
#   https://www.macports.org/install.php  then:
#   sudo port install zoxide fzf fd broot
set -e

BREW_PREFIX="/usr/local"
BREW="$BREW_PREFIX/bin/brew"
MARK_BEGIN="# >>> omp-terminal-nav >>>"
MARK_END="# <<< omp-terminal-nav <<<"
SCRIPT_DIR="${0:A:h}"

echo "== terminal-nav setup (Intel) =="

# --- 0. Xcode Command Line Tools (brew prerequisite) ---
if ! xcode-select -p >/dev/null 2>&1; then
  echo "Installing Xcode Command Line Tools (a dialog will appear — click Install)..."
  xcode-select --install || true
  echo "Re-run this script after the CLT installer finishes."
  exit 0
fi

# --- 1. Homebrew ---
if [[ ! -x "$BREW" ]]; then
  echo "Homebrew not found — installing..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [[ -x "$BREW" ]]; then
    grep -q 'brew shellenv' ~/.zprofile 2>/dev/null || \
      echo "eval \"\$($BREW shellenv)\"" >> ~/.zprofile
    eval "$("$BREW" shellenv)"
  else
    echo "ERROR: brew install did not produce $BREW" >&2
    echo "On a very old macOS, brew may be unsupported — try MacPorts (see header)." >&2
    exit 1
  fi
else
  eval "$("$BREW" shellenv)"
fi
echo "brew: $(brew --version | head -1)"

# --- 2. Tools ---
echo "Installing zoxide fzf fd broot eza..."
echo "(On an old/unsupported macOS these may build from source — be patient.)"
brew install zoxide fzf fd broot eza

# --- 3. broot shell launcher (provides `br`) ---
broot --install >/dev/null 2>&1 || true

# --- 4. fzf shell integration + nav block in ~/.zshrc ---
touch ~/.zshrc
if ! grep -qF "$MARK_BEGIN" ~/.zshrc; then
  {
    echo ""
    echo "$MARK_BEGIN"
    echo '# fzf shell integration (completion + CTRL-T/CTRL-R/ALT-C)'
    echo '[ -r /usr/local/opt/fzf/shell/completion.zsh ] && source /usr/local/opt/fzf/shell/completion.zsh'
    echo '[ -r /usr/local/opt/fzf/shell/key-bindings.zsh ] && source /usr/local/opt/fzf/shell/key-bindings.zsh'
    echo ""
    cat "$SCRIPT_DIR/zshrc-block.zsh"
    echo "$MARK_END"
  } >> ~/.zshrc
  echo "Added nav block to ~/.zshrc"
else
  echo "Nav block already present in ~/.zshrc — skipping"
fi

# --- 5. Optional: seed home folder so cdi knows every directory ---
echo ""
echo "Seed your whole home folder into zoxide now? (one-time, a few minutes)"
echo -n "This makes 'cdi <name>' find every directory under ~. [y/N] "
read -r reply
if [[ "$reply" =~ ^[Yy]$ ]]; then
  export _ZO_MAXAGE=200000
  count=0
  while IFS= read -r d; do
    zoxide add "$d" >/dev/null 2>&1 && (( count++ ))
  done < <(fd --type d --hidden \
    --exclude .git --exclude node_modules --exclude .next \
    --exclude .gradle --exclude __pycache__ --exclude .idea \
    --exclude .prd-runs --exclude dist --exclude build --exclude Library \
    . "$HOME" 2>/dev/null; print -r -- "$HOME")
  echo "Seeded $count folders into zoxide."
else
  echo "Skipped. You can seed later with:  zseed -r ~"
fi

echo ""
echo "Done. Open a new terminal (or: source ~/.zshrc), then:"
echo "  cdi <name>   interactive picker over known dirs"
echo "  cdf <name>   fuzzy-jump into ANY subdir (live filesystem)"
echo "  br           browsable tree — Option-Enter lands you inside"
echo "  ALT-C        fzf dir picker under cwd"
