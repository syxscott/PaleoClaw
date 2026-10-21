---
summary: "Migration guide for the retired HEARTBEAT.md workspace file"
title: "Retired HEARTBEAT.md workspace file"
read_when:
  - Migrating an older workspace that still has HEARTBEAT.md
---

# HEARTBEAT.md is retired

paleoclaw no longer creates `HEARTBEAT.md` in new workspaces or reads it at runtime. Heartbeat instructions now live in the system-owned monitor scratch in the shared state database.

Manage the current monitor scratch with the monitor job id from `paleoclaw automations list --all`:

```bash
paleoclaw automations scratch <jobId>
paleoclaw automations scratch <jobId> --set "..."
paleoclaw automations scratch <jobId> --file notes.md
paleoclaw automations scratch <jobId> --unset
```

If an older workspace still contains `HEARTBEAT.md`, run `paleoclaw doctor --fix`. Doctor imports its instructions into monitor scratch, converts valid legacy `tasks:` entries into cron jobs, archives the original under the state directory, and removes the workspace file.

## Related

- [Heartbeat](/gateway/heartbeat)
- [Cron CLI](/cli/cron)
- [Doctor](/cli/doctor)
- [Heartbeat config](/gateway/config-agents)
