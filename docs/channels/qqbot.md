---
summary: "QQ official bot setup, config, and usage for paleoclaw"
read_when:
  - Working on QQ bot features or the WebSocket gateway
  - You need QQ open platform credential setup
  - You want QQ-specific message options
title: "QQ"
---

# QQ (Official Bot)

QQ connects to paleoclaw through the QQ open platform official bot. The plugin receives
events over the official WebSocket gateway and sends replies through the QQ REST API.

Status: supported via plugin. Direct messages and groups are supported. Media is uploaded
through the QQ files API. Threads, reactions, message editing, and unsending are not
supported.

## Plugin required

QQ ships as a plugin and is not bundled with the core install.

- Install via CLI: `paleoclaw plugins install @paleoclaw/qqbot`
- Or select **QQ 机器人 (官方 WebSocket)** during onboarding and confirm the install prompt
- Details: [Plugins](/tools/plugin)

Local checkout (when running from a git repo):

```bash
paleoclaw plugins install ./extensions/qqbot
```

## Quick setup (beginner)

1. Install the QQ plugin (see above).
2. Create a bot on the QQ open platform and copy the AppID and the AppSecret.
3. Set the credentials:
   - Env: `QQ_APP_ID=...` and `QQ_APP_SECRET=...`
   - Or config: `channels.qqbot.appId` and `channels.qqbot.appSecret`
4. Restart the gateway (or finish onboarding).
5. DM access defaults to pairing; approve the sender on first contact.

Minimal config:

```json5
{
  channels: {
    qqbot: {
      enabled: true,
      appId: "102000000",
      appSecret: "your-app-secret",
      dmPolicy: "pairing",
    },
  },
}
```

## What it is

The QQ open platform lets a registered bot receive messages through a WebSocket gateway
and send messages through a REST API. That is the whole transport: no polling, no public
callback URL, and nothing has to be exposed to the internet for inbound traffic.

- A QQ official bot channel owned by the Gateway.
- Deterministic routing: replies go back to the same QQ chat; the model never chooses channels.
- One WebSocket session per account, with automatic reconnect and token refresh.
- Groups and direct messages share the agent's session model.

## Setup (fast path)

### 1) Create a bot (QQ open platform)

1. Sign in to the QQ open platform developer console.
2. Create a bot application and publish it to the intended audience.
3. Copy the **AppID** and the **AppSecret** (also labelled client secret) from the app
   credentials page.

### 2) Configure the credentials (env or config)

```json5
{
  channels: {
    qqbot: {
      enabled: true,
      appId: "102000000",
      appSecret: "your-app-secret",
      dmPolicy: "pairing",
      groupPolicy: "allowlist",
    },
  },
}
```

Env options (default account only):

- `QQ_APP_ID`
- `QQ_APP_SECRET`
- `QQ_CLIENT_SECRET` (alias for the app secret)

`appSecret` and `clientSecret` are interchangeable; `appSecret` wins when both are set.

### 3) Restart the gateway

The QQ channel starts as soon as an AppID and a secret are resolved. Check it with:

```bash
paleoclaw channels status --probe
```

## How it works (behavior)

- The plugin connects to the WebSocket gateway, identifies with the account intents, and
  heartbeats on the interval the server requests.
- Inbound events are normalized into the shared channel envelope. Guild events
  (`AT_MESSAGE_CREATE`, `MESSAGE_CREATE`, `DIRECT_MESSAGE_CREATE`) and the v2
  `C2C_MESSAGE_CREATE` / `GROUP_AT_MESSAGE_CREATE` events are handled.
- Replies always route back to the same chat. Mentions are stripped from the text that
  reaches the agent.
- Outbound text is sent as a markdown payload by default (`msg_type` 2). Set
  `channels.qqbot.markdown: false` to send plain text instead.
- Access tokens are cached and refreshed 60 seconds before they expire (QQ issues
  2 hour tokens).

## Limits

- Outbound text is chunked at 4000 characters.
- Media uploads go through the QQ chunked-upload API and are subject to a QQ-side daily
  upload quota.
- Guild (channel) targets do not support media send; only DM and group targets do.
- QQ cannot edit or unsend messages.
- Streaming is not blocked, but each chunk is a separate QQ message.

## Access control (DMs)

### DM access

- Default: `channels.qqbot.dmPolicy = "pairing"`. Unknown senders are held until they
  are approved.
- Approve via:
  - `paleoclaw pairing list qqbot`
  - `paleoclaw pairing approve qqbot <code>`
- Pairing is the default token exchange. Details: [Pairing](/channels/pairing)
- `channels.qqbot.allowFrom` accepts QQ openids (opaque strings). The wildcard `"*"`
  matches every sender.

## Access control (Groups)

- `channels.qqbot.groupPolicy` controls group inbound handling:
  `open | allowlist | pairing | disabled`.
- Default behavior is fail-closed: `allowlist`.
- `channels.qqbot.groupAllowFrom` restricts which groups (by `group_openid`) can trigger
  the bot.
- `groupPolicy: "disabled"` blocks all group messages.
- `groupPolicy: "open"` lets any group that has the bot trigger it.
- `groupPolicy: "pairing"` behaves like `allowlist` here: group access is decided by
  `groupAllowFrom` only.
- Group membership alone does not grant access: the allowlist is matched against the
  group id, not the member id.

## Supported message types

- **Text messages**: Full support, sent as markdown by default.
- **Images**: Sent through the QQ files API and uploaded before the message is posted.
- **Video, voice, files**: Uploaded through the same files API.
- **Keyboards**: Pass a raw QQ keyboard DSL object via the `keyboard` field. No builder is
  provided.
- **Unsupported types**: Logged and ignored.

## Capabilities

| Feature         | Status                                                   |
| --------------- | -------------------------------------------------------- |
| Direct messages | ✅ Supported                                             |
| Groups          | ⚠️ Supported with policy controls (allowlist by default) |
| Media           | ✅ Supported (uploaded through the QQ files API)         |
| Reactions       | ❌ Not supported                                         |
| Threads         | ❌ Not supported                                         |
| Polls           | ❌ Not supported                                         |
| Native commands | ❌ Not supported                                         |
| Streaming       | ⚠️ Partial (one QQ message per chunk)                    |

## Delivery targets (CLI/cron)

- Targets are opaque QQ ids. The plugin strips a leading `qqbot:` or `qq:` prefix.
- Use one of:
  - `user_openid` for a v2 direct message
  - `group_openid` for a v2 group message
  - `channel_id` for a guild channel
  - `guild_id` for a guild direct message
- Example: `paleoclaw message send --channel qqbot --target <user_openid> --message "hi"`.

## Troubleshooting

**Bot doesn't respond:**

- Check that the credentials resolve: `paleoclaw channels status --probe`
- Verify the sender is approved (pairing or `allowFrom`)
- Check gateway logs: `paleoclaw logs --follow`

**The channel never connects:**

- Confirm the bot is published and that the credentials belong to a published app
- Check the account is not disabled: `channels.qqbot.enabled`
- A revoked or rotated secret is not picked up by a running process; restart the gateway
  after changing credentials

**Replies arrive but look wrong:**

- Set `channels.qqbot.markdown: false` if markdown payloads are not rendered
- The bot must be able to see the sender's message; a deleted or expired message cannot
  be replied to

## Configuration reference (QQ)

Full configuration: [Configuration](/gateway/configuration)

Provider options:

- `channels.qqbot.enabled`: enable/disable channel startup.
- `channels.qqbot.appId`: QQ open platform AppID.
- `channels.qqbot.appSecret`: app secret used to obtain the access token.
- `channels.qqbot.clientSecret`: alias for `appSecret`.
- `channels.qqbot.mode`: transport mode. Only `"websocket"` is implemented.
- `channels.qqbot.sandbox`: point REST calls at the QQ sandbox API. Default `false`.
- `channels.qqbot.markdown`: send outbound text as a markdown payload. Default `true`.
- `channels.qqbot.intents`: gateway intent bit field. Defaults to guild messages, direct
  messages, C2C/group at-messages, and public guild messages.
- `channels.qqbot.dmPolicy`: `open | allowlist | pairing | disabled` (default: `pairing`).
- `channels.qqbot.allowFrom`: DM allowlist (QQ openids). `"*"` allows every sender.
- `channels.qqbot.groupPolicy`: `open | allowlist | pairing | disabled` (default:
  `allowlist`).
- `channels.qqbot.groupAllowFrom`: group allowlist (group openids).
- `channels.qqbot.defaultTo`: default target used when no target is supplied.
- `channels.qqbot.name`: display name for the account.
- `channels.qqbot.defaultAccount`: account id used when no account is given.

Multi-account options:

- `channels.qqbot.accounts.<id>.appId`: per-account AppID.
- `channels.qqbot.accounts.<id>.appSecret`: per-account app secret.
- `channels.qqbot.accounts.<id>.clientSecret`: per-account secret alias.
- `channels.qqbot.accounts.<id>.enabled`: enable/disable account.
- `channels.qqbot.accounts.<id>.name`: display name.
- `channels.qqbot.accounts.<id>.mode`: per-account transport mode.
- `channels.qqbot.accounts.<id>.sandbox`: per-account sandbox flag.
- `channels.qqbot.accounts.<id>.markdown`: per-account markdown flag.
- `channels.qqbot.accounts.<id>.intents`: per-account intent bit field.
- `channels.qqbot.accounts.<id>.dmPolicy`: per-account DM policy.
- `channels.qqbot.accounts.<id>.allowFrom`: per-account DM allowlist.
- `channels.qqbot.accounts.<id>.groupPolicy`: per-account group policy.
- `channels.qqbot.accounts.<id>.groupAllowFrom`: per-account group allowlist.
- `channels.qqbot.accounts.<id>.defaultTo`: per-account default target.
