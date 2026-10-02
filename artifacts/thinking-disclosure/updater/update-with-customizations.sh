#!/bin/bash
set -euo pipefail

root=${OMP_DURABLE_ROOT:-"$HOME/.local/libexec/omp-devin"}
updater="$root/updater"
patch_dir="$updater/patches"
lock_dir="$updater/update.lock"
mkdir -p "$updater/logs"
log="$updater/logs/update-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$log") 2>&1

if ! mkdir "$lock_dir" 2>/dev/null; then
  echo "Another durable OMP update is already running." >&2
  exit 75
fi

work_dir=$(mktemp -d "$updater/work.XXXXXX")
build_dir="$work_dir/source"
worktree_repo=""
worktree_bare=0

cleanup() {
  if [ -n "$worktree_repo" ] && [ -d "$build_dir" ]; then
    if [ "$worktree_bare" -eq 1 ]; then
      git --git-dir="$worktree_repo" worktree remove --force "$build_dir" >/dev/null 2>&1 || true
    else
      git -C "$worktree_repo" worktree remove --force "$build_dir" >/dev/null 2>&1 || true
    fi
  fi
  rm -rf "$work_dir"
  rmdir "$lock_dir" 2>/dev/null || true
}
trap cleanup EXIT HUP INT TERM

binary_version() {
  local output
  output=$("$1" --version)
  case "$output" in
    omp/*) printf '%s\n' "${output#omp/}" ;;
    *) echo "Unexpected OMP version output: $output" >&2; return 1 ;;
  esac
}

activate_artifact() {
  local artifact_name=$1
  local next_link="$root/current.next.$$"
  rm -f "$next_link"
  ln -s "$artifact_name" "$next_link"
  mv -f "$next_link" "$root/current"
  "$root/current/omp" config set hideThinkingBlock true
  "$root/current/omp" config set thinkingDisclosure true
  "$root/current/omp" --version
}

install_upstream_fallback() {
  local version=$1
  local source_binary=$2
  local artifact_name="${version}-upstream"
  local artifact_dir="$root/$artifact_name"
  local temporary="$root/.${artifact_name}.$$"

  rm -rf "$temporary"
  mkdir -p "$temporary"
  cp "$source_binary" "$temporary/omp"
  chmod 755 "$temporary/omp"
  [ "$(binary_version "$temporary/omp")" = "$version" ]
  if [ ! -d "$artifact_dir" ]; then
    mv "$temporary" "$artifact_dir"
  else
    rm -rf "$temporary"
  fi
  activate_artifact "$artifact_name"
}

prepare_source() {
  local version=$1
  local source_ref=${OMP_DURABLE_SOURCE_REF:-"refs/tags/v$version"}

  if [ -n "${OMP_DURABLE_SOURCE_REPO:-}" ]; then
    worktree_repo=$OMP_DURABLE_SOURCE_REPO
    git -C "$worktree_repo" worktree add --detach "$build_dir" "$source_ref"
    return
  fi

  worktree_repo="$updater/source.git"
  worktree_bare=1
  if [ ! -d "$worktree_repo" ]; then
    git clone --bare --filter=blob:none https://github.com/can1357/oh-my-pi.git "$worktree_repo"
  fi
  git --git-dir="$worktree_repo" fetch --force origin "refs/tags/v$version:refs/tags/v$version"
  git --git-dir="$worktree_repo" worktree add --detach "$build_dir" "$source_ref"
}

apply_custom_patches() {
  local patch
  for patch in "$patch_dir"/*.patch; do
    [ -f "$patch" ] || continue
    if git -C "$build_dir" apply --reverse --check "$patch" >/dev/null 2>&1; then
      echo "Already integrated upstream: $(basename "$patch")"
    else
      echo "Applying $(basename "$patch")"
      git -C "$build_dir" apply --3way "$patch" || return 1
    fi
  done
}

build_custom_binary() {
  local version=$1
  local commit artifact_name artifact_dir temporary built

  prepare_source "$version" || return 1
  apply_custom_patches || return 1
  (
    cd "$build_dir"
    bun install --frozen-lockfile --ignore-scripts || exit 1
    bun --cwd=packages/natives run build || exit 1
    bun test packages/coding-agent/test/slash-commands/mode-attachments.test.ts packages/coding-agent/test/modes/components/assistant-message-error.test.ts packages/coding-agent/test/modes/components/assistant-message-mermaid.test.ts || exit 1
    bun --cwd=packages/coding-agent run check || exit 1
    bun --cwd=packages/coding-agent run build || exit 1
  ) || return 1

  built="$build_dir/packages/coding-agent/dist/omp"
  [ "$(binary_version "$built")" = "$version" ] || return 1
  "$built" config get thinkingDisclosure --json >/dev/null || return 1

  commit=$(git -C "$build_dir" rev-parse --short=12 HEAD)
  artifact_name="${version}-${commit}-thinking-disclosure"
  artifact_dir="$root/$artifact_name"
  temporary="$root/.${artifact_name}.$$"
  rm -rf "$temporary"
  mkdir -p "$temporary"
  cp "$built" "$temporary/omp"
  cp "$updater/activate-version.sh" "$temporary/activate.sh"
  chmod 755 "$temporary/omp" "$temporary/activate.sh"
  if [ ! -d "$artifact_dir" ]; then
    mv "$temporary" "$artifact_dir"
  else
    rm -rf "$temporary"
  fi
  activate_artifact "$artifact_name"
}

reapply=0
if [ "${1-}" = "--reapply-customizations" ]; then
  reapply=1
  shift
fi

current_binary="$root/current/omp"
current_version=$(binary_version "$current_binary")
stage_binary="$current_binary"

if [ "$reapply" -eq 0 ]; then
  stage_bin_dir="$work_dir/bin"
  mkdir -p "$stage_bin_dir"
  cp "$current_binary" "$stage_bin_dir/omp"
  chmod 755 "$stage_bin_dir/omp"
  stage_binary="$stage_bin_dir/omp"

  echo "Running the official OMP updater in an isolated staging path..."
  PATH="$stage_bin_dir:$PATH" "$stage_binary" update "$@"
fi

updated_version=$(binary_version "$stage_binary")
if [ "$reapply" -eq 0 ] && [ "$updated_version" = "$current_version" ]; then
  echo "OMP remains at $current_version; no custom rebuild is needed."
  exit 0
fi

if build_custom_binary "$updated_version"; then
  echo "OMP $updated_version is active with durable customizations reapplied."
  exit 0
fi

if [ "$reapply" -eq 1 ]; then
  echo "Customization rebuild failed; the existing OMP $current_version remains active." >&2
  echo "Details: $log" >&2
  exit 1
fi

install_upstream_fallback "$updated_version" "$stage_binary"
echo "OMP updated to official $updated_version, but automatic customization reapplication failed." >&2
echo "The update remains active; disclosure can be restored after rebasing the saved patches. Details: $log" >&2
exit 1
