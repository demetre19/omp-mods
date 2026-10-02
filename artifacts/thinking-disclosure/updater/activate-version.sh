#!/bin/sh
set -eu

artifact_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
root=$(dirname "$artifact_dir")
label=dev.demetre.omp-durable-launcher
plist="$HOME/Library/LaunchAgents/$label.plist"
domain="gui/$(id -u)"

next="$root/current.next.$$"
rm -f "$next"
ln -s "$(basename "$artifact_dir")" "$next"
mv -f "$next" "$root/current"
"$root/launcher/restore.sh"

if launchctl print "$domain/$label" >/dev/null 2>&1; then
  launchctl kickstart -k "$domain/$label"
else
  launchctl bootstrap "$domain" "$plist"
fi

"$HOME/.local/bin/omp" --version
