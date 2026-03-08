---
summary: "CLI reference for `paleoclaw reset` (reset local state/config)"
read_when:
  - You want to wipe local state while keeping the CLI installed
  - You want a dry-run of what would be removed
title: "reset"
---

# `paleoclaw reset`

Reset local config/state (keeps the CLI installed).

```bash
paleoclaw reset
paleoclaw reset --dry-run
paleoclaw reset --scope config+creds+sessions --yes --non-interactive
```
