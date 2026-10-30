---
summary: "Zalo Personal plugin: QR login + messaging via native zca-js (plugin install + channel config + tool)"
read_when:
  - You want Zalo Personal (unofficial) support in paleoclaw
  - You are configuring or developing the zalouser plugin
title: "Zalo personal plugin"
---

The zalouser plugin adds unofficial Zalo Personal support to OpenClaw. It uses
native `zca-js` to automate a normal Zalo user account. No external
`zca`/`openzca` CLI binary is required.

<Warning>
Unofficial automation may lead to account suspension or ban. Use at your own risk.
</Warning>

## Naming

Channel id is `zalouser` to make it explicit this automates a **personal Zalo
user account** (unofficial). The separate `zalo` channel id is the official,
bundled Zalo Bot/webhook integration - see [Zalo](/channels/zalo).

## Where it runs

This plugin runs **inside the Gateway process**. For a remote Gateway,
install/configure it on that host. Installation applies to a running Gateway
automatically; if it is offline, start it after configuration.

## Install

### From npm

```bash
paleoclaw plugins install @paleoclaw/zalouser
```

Use the bare package to follow the current official release tag; pin an exact
version only when you need a reproducible install. Check the installation's
application result; see [Apply changes and inspect](/plugins/manage-plugins#apply-changes-and-inspect).

### From a local folder (dev)

```bash
cd ./path/to/local/zalouser-plugin
pnpm install
paleoclaw plugins install --link .
```

After subsequent source or manifest edits, run `paleoclaw plugins reload zalouser`.

## Config

Channel config lives under `channels.zalouser` (not `plugins.entries.*`):

```json5
{
  channels: {
    zalouser: {
      enabled: true,
      dmPolicy: "pairing",
    },
  },
}
```

See [Zalo personal channel config](/channels/zalouser) for DM/group access
control, multi-account setup, environment variables, and troubleshooting.

## CLI

```bash
paleoclaw channels login --channel zalouser
paleoclaw channels login --channel zalouser --account <name>
paleoclaw channels logout --channel zalouser
paleoclaw channels status --probe
paleoclaw message send --channel zalouser --target <threadId> --message "Hello from paleoclaw"
paleoclaw directory self --channel zalouser
paleoclaw directory peers list --channel zalouser --query "name"
paleoclaw directory groups list --channel zalouser --query "name"
paleoclaw directory groups members --channel zalouser --group-id <id>
```

## Agent tool

Tool name: `zalouser`

Actions: `send`, `image`, `link`, `friends`, `groups`, `me`, `status`

Channel message actions (not the agent tool) also support `react` for message
reactions.

## Related

- [Zalo personal channel config](/channels/zalouser)
- [Zalo (official Bot/webhook channel)](/channels/zalo)
- [Building plugins](/plugins/building-plugins)
- [PaleoHub](/PaleoHub)
