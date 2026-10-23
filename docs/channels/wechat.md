---
summary: "WeChat channel setup through the external paleoclaw-weixin plugin"
read_when:
  - You want to connect paleoclaw to WeChat or Weixin
  - You are installing or troubleshooting the paleoclaw-weixin channel plugin
  - You need to understand how external channel plugins run beside the Gateway
title: "WeChat"
---

paleoclaw connects to WeChat through Tencent's external
`@tencent-weixin/paleoclaw-weixin` channel plugin.

Status: external plugin, maintained by the Tencent Weixin team. Direct chats and
media are supported. Group chats are not advertised by the plugin capability
metadata (it declares direct chats only).

## Naming

- **WeChat** is the user-facing name in these docs.
- **Weixin** is the name used by Tencent's package and by the plugin id.
- `paleoclaw-weixin` is the paleoclaw channel id (`weixin` and `wechat` work as aliases).
- `@tencent-weixin/paleoclaw-weixin` is the npm package.

Use `paleoclaw-weixin` in CLI commands and config paths.

## How it works

The WeChat code does not live in the paleoclaw core repo. paleoclaw provides the
generic channel plugin contract, and the external plugin provides the
WeChat-specific runtime:

1. `paleoclaw plugins install` installs `@tencent-weixin/paleoclaw-weixin`.
2. The Gateway discovers the plugin manifest and loads the plugin entrypoint.
3. The plugin registers channel id `paleoclaw-weixin`.
4. `paleoclaw channels login --channel paleoclaw-weixin` starts QR login.
5. The plugin stores account credentials under the paleoclaw state directory
   (`~/.openclaw` by default).
6. When the Gateway starts, the plugin starts its Weixin monitor for each
   configured account.
7. Inbound WeChat messages are normalized through the channel contract, routed to
   the selected paleoclaw agent, and sent back through the plugin outbound path.

That separation matters: paleoclaw core stays channel-agnostic. WeChat login,
Tencent iLink API calls, media upload/download, context tokens, and account
monitoring are owned by the external plugin.

## Install

Quick install:

```bash
npx -y @tencent-weixin/paleoclaw-weixin-cli install
```

Manual install:

```bash
paleoclaw plugins install "@tencent-weixin/paleoclaw-weixin"
paleoclaw plugins enable paleoclaw-weixin
```

The plugin commands apply changes to a running Gateway. Check the
[application result](/plugins/manage-plugins#apply-changes-and-inspect); start the
Gateway if it is offline.

## Login

Run QR login on the same machine that runs the Gateway:

```bash
paleoclaw channels login --channel paleoclaw-weixin
```

Scan the QR code with WeChat on your phone and confirm the login. The plugin saves
the account token locally after a successful scan.

To add another WeChat account, run the same login command again. For multiple
accounts, isolate direct-message sessions by account, channel, and sender:

```bash
paleoclaw config set session.dmScope per-account-channel-peer
```

## Access control

Version `2.4.8` does not register an paleoclaw pairing adapter or create pairing
requests. The standard pairing list and approve commands cannot establish DM
access for this version. QR login can still allow the user who scanned the code
to chat with the bot.

This version reads a legacy account allowlist JSON file instead of paleoclaw's
SQLite pairing store. When that list is empty, it falls back to the QR scanner's
saved user ID. If neither provides a user ID, its sender check admits any sender
whose message reaches the plugin.

On current paleoclaw, `paleoclaw doctor --fix` imports legacy approvals into SQLite
and removes the source file. Previously approved secondary
senders can therefore lose access in version `2.4.8`. Revoking an approval in
SQLite does not revoke access granted by the plugin's legacy file or scanner
fallback.

Do not rely on standard pairing to manage or revoke DM access with version
`2.4.8`. If you need pairing enforcement, [temporarily disable the plugin](/channels/wechat#troubleshooting)
until a version with repaired pairing support is available.

For integrations that implement paleoclaw's pairing API, see [Pairing](/channels/pairing).

## Compatibility

The package declares these paleoclaw requirements:

| Plugin version | Declared paleoclaw requirement | npm tag  |
| -------------- | ----------------------------- | -------- |
| `2.4.8`        | `>=2026.5.12`                 | `latest` |
| `1.x`          | `>=2026.1.0 <2026.3.22`       | `legacy` |

Version `2.4.8` declares `>=2026.5.12`, but its startup version guard still checks
`>=2026.3.22`. Passing that guard alone does not satisfy the declared requirement.

If the plugin reports that your paleoclaw version is too old, either update
paleoclaw or install the legacy plugin line:

```bash
paleoclaw plugins install @tencent-weixin/paleoclaw-weixin@legacy
```

Plugin 2.4.6 imports the retired `paleoclaw/plugin-sdk/channel-runtime` path and
cannot load on paleoclaw 2026.8.1. If startup reports that this subpath is not
exported, update to plugin 2.4.8, which uses the available SDK path:

```bash
paleoclaw plugins update @tencent-weixin/paleoclaw-weixin@2.4.8
```

## Sidecar process

The WeChat plugin can run helper work beside the Gateway while it monitors the
Tencent iLink API. In [issue #68451](https://github.com/openclaw/openclaw/issues/68451), that helper path exposed a bug in paleoclaw's
generic stale-Gateway cleanup: a child process could try to clean up the parent
Gateway process, causing restart loops under process managers such as systemd.

Current paleoclaw startup cleanup excludes the current process and its ancestors,
so a channel helper cannot kill the Gateway that launched it. This fix is
generic; it is not a WeChat-specific path in core.

## Troubleshooting

Check install and status:

```bash
paleoclaw plugins list
paleoclaw channels status --probe
paleoclaw --version
```

If the channel shows as installed but does not connect, enable it and inspect the
running plugin:

```bash
paleoclaw plugins enable paleoclaw-weixin
paleoclaw plugins inspect paleoclaw-weixin --runtime --json
```

If the Gateway restarts repeatedly after enabling WeChat, update both paleoclaw and
the plugin:

```bash
npm view @tencent-weixin/paleoclaw-weixin version
paleoclaw plugins install "@tencent-weixin/paleoclaw-weixin" --force
paleoclaw gateway restart
```

If startup reports that the installed plugin package `requires compiled runtime
output for TypeScript entry`, the npm package was published without the compiled
JavaScript runtime files paleoclaw needs. Update/reinstall after the plugin
publisher ships a fixed package, or temporarily disable/uninstall the plugin.

Temporary disable:

```bash
paleoclaw plugins disable paleoclaw-weixin
```

## Related docs

- Channel overview: [Chat Channels](/channels)
- Pairing: [Pairing](/channels/pairing)
- Channel routing: [Channel routing](/channels/channel-routing)
- Plugin architecture: [Plugin Architecture](/plugins/architecture)
- Channel plugin SDK: [Channel Plugin SDK](/plugins/sdk-channel-plugins)
- External package: [@tencent-weixin/paleoclaw-weixin](https://www.npmjs.com/package/@tencent-weixin/paleoclaw-weixin)
