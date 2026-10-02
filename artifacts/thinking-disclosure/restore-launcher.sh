#!/bin/sh
set -eu

root=${OMP_DURABLE_ROOT:-"$HOME/.local/libexec/omp-devin"}
source_launcher="$root/launcher/omp"
target="$HOME/.local/bin/omp"
temporary="$target.durable-restore.$$"

cleanup() {
  rm -f "$temporary"
}
trap cleanup EXIT HUP INT TERM

if [ -f "$target" ] && cmp -s "$source_launcher" "$target"; then
  exit 0
fi

mkdir -p "$(dirname "$target")"
cp "$source_launcher" "$temporary"
chmod 755 "$temporary"
"$temporary" --version >/dev/null
mv -f "$temporary" "$target"
trap - EXIT HUP INT TERM
