# Send the macOS clipboard to a Tailscale-connected device

## What this adds

This workflow combines two existing pieces:

1. macOS `pbpaste` prints the current clipboard contents to standard output.
2. `msg` reads that text from standard input and sends it to a selected device through a private HTTP connector reachable over Tailscale.

It is useful with STM Desktop Listener's **Command Shortcuts** feature: assign one saved command to a phone shortcut and another to a laptop shortcut, then send whatever is currently copied without opening Terminal.

## STM Desktop Listener commands

Add each command as its own saved command shortcut.

Send the clipboard to the phone:

```sh
/usr/bin/pbpaste | /Users/apple/.local/bin/msg phone
```

Send the clipboard to the laptop:

```sh
/usr/bin/pbpaste | /Users/apple/.local/bin/msg laptop
```

Optional targets supported by the included utility:

```sh
/usr/bin/pbpaste | /Users/apple/.local/bin/msg mini
/usr/bin/pbpaste | /Users/apple/.local/bin/msg all
```

The pipe (`|`) passes clipboard bytes directly to `msg`. This is safer than inserting clipboard text into a quoted shell command: quotes, URLs, spaces, and multiline text remain message content rather than becoming shell syntax.

An empty clipboard is rejected. Messages must contain between 1 and 16,384 UTF-8 bytes.

## Install the reusable `msg` command

The portable source is [`artifacts/msg/msg`](../artifacts/msg/msg). It intentionally contains no private Tailnet hostname, token, or credential.

```sh
mkdir -p "$HOME/.local/bin"
cp artifacts/msg/msg "$HOME/.local/bin/msg"
chmod 700 "$HOME/.local/bin/msg"
```

Configure the private connector URL in the environment used to launch STM Desktop Listener. For an interactive shell test:

```sh
export CONNECTOR_URL='http://your-private-tailscale-host:45873'
printf '%s' 'Test message' | "$HOME/.local/bin/msg" phone
```

`CONNECTOR_URL` must be the base URL of a connector that accepts `POST /send/laptop`, `/send/mini`, `/send/phone`, and `/send/all`, returning HTTP `202` when a message is queued.

For STM Desktop Listener shortcuts, `CONNECTOR_URL` must be available to the launched app process. Alternatively, install a private local copy of `msg` with the connector URL configured locally. Never commit a private Tailnet hostname or credential to this public repository.

## What `msg` does

- Accepts one destination: `laptop`, `mini`, `phone`, or `all`.
- Reads a message from command arguments or standard input.
- Stores request and response bodies in permission-controlled temporary files and removes them on exit.
- Rejects empty messages and messages larger than 16 KiB.
- Posts the exact bytes as `text/plain; charset=utf-8` to the selected connector route.
- Uses short connection and request timeouts.
- Reports success only when the connector returns HTTP `202`.

Tailscale supplies private network reachability; the script itself does not install Tailscale or run the receiving connector.

## Compatibility

- Clipboard shortcuts require macOS because they use `/usr/bin/pbpaste`.
- The `msg` utility uses POSIX `sh`, `mktemp`, `wc`, `tr`, and `curl`.
- This is an STM Desktop Listener workflow artifact, not an OMP source patch.
