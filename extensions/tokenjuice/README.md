# @paleoclaw/tokenjuice

Official Tokenjuice output compaction plugin for OpenClaw.

Tokenjuice compacts noisy `exec` and `bash` tool results after commands run, before the result is fed back into the active agent session. It does not rewrite commands, rerun commands, or change exit codes.

## Install

```bash
paleoclaw plugins install @paleoclaw/tokenjuice
```

Restart the Gateway after installing or updating the plugin.

## Enable

```bash
paleoclaw config set plugins.entries.tokenjuice.enabled true
```

Equivalent:

```bash
paleoclaw plugins enable tokenjuice
```

## Docs

- https://docs.openclaw.ai/tools/tokenjuice

## Package

- Plugin id: `tokenjuice`
- Package: `@paleoclaw/tokenjuice`
- Minimum paleoclaw host: `2026.5.28`
