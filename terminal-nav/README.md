# terminal-nav — fuzzy filesystem navigation for zsh

See and jump into directories fast — including ones you've never visited.
Replaces the `ls` → `cd` hunt with fuzzy pickers and a browsable tree.

## What's included

| Command | What it does | Sees unvisited dirs? |
|---|---|---|
| `cd <name>` | zoxide smart-jump to a known dir | No — visited/seeded only |
| `cdi` | Interactive fzf picker over zoxide's db | No — visited/seeded only |
| `cdf [root] [query]` | Fuzzy-pick **any** subdirectory, live from the filesystem | **Yes** |
| `br` | broot tree navigator — arrows + type-to-filter | **Yes** |
| `ALT-C` | fzf dir picker under cwd (fd-backed) | **Yes** |
| `zseed [-r] [dir]` | Add dirs to zoxide's db so `cd`/`cdi` know them | — |

**Why two kinds?** zoxide (`cd`/`cdi`) is a "frecency" tracker — it only knows
directories you've visited or seeded. `cdf`/`br`/`ALT-C` read the live
filesystem, so nothing is invisible. Use `cdi` for places you go often,
`cdf`/`br` to find anything.

## Install

Pick the script for your Mac's chip (`Apple menu → About This Mac`):

```sh
# Apple Silicon (M1/M2/M3/M4) — brew prefix /opt/homebrew
./setup-apple-silicon.sh

# Intel — brew prefix /usr/local
./setup-intel.sh
```

Both scripts are self-contained and safe to re-run:

1. Install **Xcode Command Line Tools** if missing (brew prerequisite).
2. Install **Homebrew** if missing (adds `brew shellenv` to `~/.zprofile`).
   - Intel on a very old macOS: brew may be unsupported — see the script
     header for the MacPorts fallback.
3. `brew install zoxide fzf fd broot eza`
4. `broot --install` (provides the `br` launcher)
5. Append the nav block to `~/.zshrc` between `# >>> omp-terminal-nav >>>`
   markers — skipped if already present.
6. Offer to **seed your whole home folder** into zoxide so `cdi` knows every
   directory (one-time, a few minutes; re-run later with `zseed -r ~`).

### Manual install (no script)

If you'd rather paste it yourself: install the tools, run `broot --install`,
then append [`zshrc-block.zsh`](./zshrc-block.zsh) to `~/.zshrc` and
`source ~/.zshrc`.

## Usage

```sh
cdi kal            # picker over seeded/visited dirs -> Kal Kristhogoo
cdf kal            # same, but searches the live filesystem — always works
cdf ~ proj         # search under ~ for dirs matching "proj"
cdf . "My Dir"     # search under cwd for a dir with a space
br                 # tree: type to filter, arrows to move,
                   #   Option-Enter (or :cd + Enter) lands your shell inside
zseed -r ~         # (re)seed every dir under home into zoxide
```

### broot keys

| Key | Action |
|---|---|
| type | filter live (like `cdi`) |
| ↑ / ↓ | move selection |
| Enter | step into a directory |
| Esc | clear filter / go up |
| **Option-Enter** | quit and `cd` the shell into the selection |
| `:cd` + Enter | same, if Option-Enter doesn't register |
| Ctrl-C | quit without moving |

## Troubleshooting

- **`cdf`/`zseed`: command not found** — the shell predates the edit.
  Run `source ~/.zshrc` or open a new tab.
- **`cdi` doesn't find a dir** — it's not in zoxide's db. Either `cd` into it
  once, run `zseed -r <parent>`, or just use `cdf` (no seeding needed).
- **Bulk-seeded dirs vanished** — zoxide's `_ZO_MAXAGE` (default 10k total
  rank) evicts low-rank entries. The block sets it to 200000; make sure that
  export lands *before* `zoxide init`.
- **Old Intel Mac, brew unsupported** — installs may compile from source
  (slow). If brew won't install at all, use MacPorts per the script header.

## Files

- `setup-apple-silicon.sh` — installer for M-series Macs (`/opt/homebrew`)
- `setup-intel.sh` — installer for Intel Macs (`/usr/local`)
- `zshrc-block.zsh` — the shell block both scripts append; paste manually if preferred
