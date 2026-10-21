---
summary: "CLI reference for `paleoclaw clawbot` (legacy alias namespace)"
read_when:
  - You maintain older scripts using `paleoclaw clawbot ...`
  - You need migration guidance to current commands
title: "Clawbot"
---

# `paleoclaw clawbot`

Legacy alias namespace kept for backward compatibility. It registers the same QR command as the top-level CLI, so `paleoclaw clawbot qr` accepts every [`paleoclaw qr`](/cli/qr) flag. No removal is scheduled; prefer the top-level commands in new scripts.

## Migration

Prefer the modern top-level command:

- `paleoclaw clawbot qr` -> `paleoclaw qr`

## Related

- [CLI reference](/cli)
