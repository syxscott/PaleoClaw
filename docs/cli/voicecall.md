---
summary: "CLI reference for `paleoclaw voicecall` (voice-call plugin command surface)"
read_when:
  - You use the voice-call plugin and want the CLI entry points
  - You want quick examples for `voicecall call|continue|status|tail|expose`
title: "voicecall"
---

# `paleoclaw voicecall`

`voicecall` is a plugin-provided command. It only appears if the voice-call plugin is installed and enabled.

Primary doc:

- Voice-call plugin: [Voice Call](/plugins/voice-call)

## Common commands

```bash
paleoclaw voicecall status --call-id <id>
paleoclaw voicecall call --to "+15555550123" --message "Hello" --mode notify
paleoclaw voicecall continue --call-id <id> --message "Any questions?"
paleoclaw voicecall end --call-id <id>
```

## Exposing webhooks (Tailscale)

```bash
paleoclaw voicecall expose --mode serve
paleoclaw voicecall expose --mode funnel
paleoclaw voicecall expose --mode off
```

Security note: only expose the webhook endpoint to networks you trust. Prefer Tailscale Serve over Funnel when possible.
