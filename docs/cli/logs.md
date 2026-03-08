---
summary: "CLI reference for `paleoclaw logs` (tail gateway logs via RPC)"
read_when:
  - You need to tail Gateway logs remotely (without SSH)
  - You want JSON log lines for tooling
title: "logs"
---

# `paleoclaw logs`

Tail Gateway file logs over RPC (works in remote mode).

Related:

- Logging overview: [Logging](/logging)

## Examples

```bash
paleoclaw logs
paleoclaw logs --follow
paleoclaw logs --json
paleoclaw logs --limit 500
paleoclaw logs --local-time
paleoclaw logs --follow --local-time
```

Use `--local-time` to render timestamps in your local timezone.
