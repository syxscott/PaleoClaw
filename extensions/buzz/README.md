# @paleoclaw/buzz

Official Buzz channel plugin for OpenClaw. It connects an paleoclaw agent to approved Buzz rooms for text conversations and threaded replies.

## Requirements

You need:

- A Buzz relay URL
- A Buzz owner or admin
- A room where the bot can receive the **Bot** role

Use `wss://` outside local development.

## Set up

```bash
paleoclaw channels add --channel buzz
```

paleoclaw installs the plugin if needed, asks for the relay URL, and generates a dedicated bot identity.

Give the displayed **public key only** to a Buzz owner or admin:

```bash
buzz channels add-member \
  --channel <ROOM_UUID> \
  --pubkey <BOT_PUBLIC_KEY> \
  --role bot
```

Closed relays may also require the bot to be added as a relay member. Setup waits for approval, discovers accessible rooms, and saves the selected rooms and default target.

Restart the Gateway if it was already running.

## Verify

```bash
paleoclaw channels status --probe
```

Inspect the current bot, approved rooms, and room members:

```bash
paleoclaw directory self --channel buzz
paleoclaw directory peers list --channel buzz
paleoclaw directory groups list --channel buzz
paleoclaw directory groups members --channel buzz --group-id buzz:<ROOM_UUID>
```

Buzz profile and room names are used as display labels, while public keys and
room UUIDs remain the stable identities. Archived rooms are omitted; an
archive or restore event rebuilds only the Buzz connection's room
subscriptions and does not stop the Gateway.

Send a test message:

```bash
paleoclaw message send \
  --channel buzz \
  --target <ROOM_UUID> \
  --message "Hello from paleoclaw"
```

## Security and scope

- Never give paleoclaw a human owner's private key.
- The generated bot private key is stored in paleoclaw configuration; only its public key is displayed.
- Treat Buzz messages as untrusted agent input.
- Currently supported: text conversations, threads, typing, and directory
  lookup in group rooms.
- Not yet supported: DMs, media, reactions, or creating rooms from OpenClaw.

Full documentation: https://docs.openclaw.ai/channels/buzz

Package: `@paleoclaw/buzz` · Plugin ID: `buzz`
