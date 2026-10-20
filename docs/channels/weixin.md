---
summary: "WeChat iLink bot bridge setup, config, and usage"
read_when:
  - Working on WeChat features or the iLink bot bridge
  - You need WeChat QR login and credential setup
  - You want WeChat-specific message options
title: "WeChat"
---

# WeChat (iLink Bot Bridge)

WeChat connects to paleoclaw through Tencent's iLink bot HTTP API. The plugin logs a bot
identity in with a QR code, long-polls for incoming messages, and echoes the peer's
context token on every reply.

Status: supported via plugin. Direct messages are supported and the text path is
complete. Media, group handling, and message editing are not supported.

## Plugin required

WeChat ships as a plugin and is not bundled with the core install.

- Install via CLI: `paleoclaw plugins install @paleoclaw/weixin`
- Or select **微信 WeChat (iLink bot)** during onboarding and confirm the install prompt
- Details: [Plugins](/tools/plugin)

Local checkout (when running from a git repo):

```bash
paleoclaw plugins install ./extensions/weixin
```

## Quick setup (beginner)

1. Install the WeChat plugin (see above).
2. Log the bot identity in with a QR code and note the **bot id** and **bot token**.
3. Configure the credentials:
   - Env: `WEIXIN_TOKEN=...` and `WEIXIN_ACCOUNT_ID=...`
   - Or config: `channels.weixin.token` and `channels.weixin.botId`
4. Restart the gateway (or finish onboarding).
5. DM access defaults to pairing; approve the sender on first contact.

Minimal config:

```json5
{
  channels: {
    weixin: {
      enabled: true,
      botId: "xxxxxxxx@im.bot",
      token: "your-bot-token",
      dmPolicy: "pairing",
    },
  },
}
```

## What it is

Tencent's iLink bot API exposes a bot identity that behaves like a regular WeChat
account. The plugin talks to it over plain HTTPS and JSON, with no native dependencies
and no protocol-level reverse engineering.

- A WeChat personal-account bridge owned by the Gateway.
- Deterministic routing: replies go back to the peer the message came from.
- No public callback URL is needed; inbound messages arrive by long poll.
- Media upload and download are stubbed behind an interface; v1 is text only.

## Setup (fast path)

### 1) Log the bot identity in (QR code)

1. Request a login QR code from the iLink bot API
   (`ilink/bot/get_bot_qrcode`).
2. Poll `ilink/bot/get_qrcode_status` until the status is `confirmed`.
3. The confirmed response carries the bot id (`ilink_bot_id`) and the bot token
   (`bot_token`).

The plugin exposes this handshake as `qrLogin(...)`, which returns the QR image content
for display and, once the scan is confirmed, the account id, the token, and the base URL.

### 2) Configure the credentials (env or config)

```json5
{
  channels: {
    weixin: {
      enabled: true,
      botId: "xxxxxxxx@im.bot",
      token: "your-bot-token",
      dmPolicy: "pairing",
      groupPolicy: "disabled",
      maxMessageLength: 2000,
    },
  },
}
```

Env options (default account only):

- `WEIXIN_TOKEN`
- `WEIXIN_ACCOUNT_ID`

Both values are required for the account to be considered configured.

### 3) Restart the gateway

The WeChat channel starts as soon as a token and a bot id are resolved. Check it with:

```bash
paleoclaw channels status --probe
```

## How it works (behavior)

- The plugin long-polls `ilink/bot/getupdates` and tracks the sync cursor, so nothing is
  missed between polls and no public endpoint is required.
- Inbound messages are normalized into the shared channel envelope. The text of the
  message is extracted from the `item_list` payload.
- Every reply must echo the peer's latest `context_token`. The plugin caches these
  tokens on disk (under the state directory) so a reply still works after a gateway
  restart.
- Replies are normalized to copy-friendly plain text and split to
  `channels.weixin.maxMessageLength` before they are sent.
- A stale session (`ret = -14`) is detected and the poll is retried.

## Limits

- Outbound text is split at `channels.weixin.maxMessageLength` characters (default 2000).
- Media is not supported: the CDN upload and download paths are stubbed, so images,
  video, voice, and files are not delivered.
- The iLink bot identity typically cannot be invited into ordinary WeChat groups, so
  group delivery may never arrive.
- Streaming is not supported; the agent sends a final message only.

## Access control (DMs)

- `channels.weixin.dmPolicy` controls who may message the bot:
  `open | pairing | allowlist | disabled`.
- Default: `pairing`.
- `channels.weixin.allowFrom` holds the iLink user ids that are allowed to message the
  bot.
- Approve a sender interactively with:
  - `paleoclaw pairing list weixin`
  - `paleoclaw pairing approve weixin <code>`
- Pairing details: [Pairing](/channels/pairing)

## Access control (Groups)

- `channels.weixin.groupPolicy` controls group inbound handling:
  `open | allowlist | disabled`.
- Default behavior is fail-closed: `disabled`.
- `channels.weixin.groupAllowFrom` restricts which groups may trigger the bot.
- The plugin warns at startup when `groupPolicy` is not `disabled`, because the iLink bot
  identity usually cannot join ordinary WeChat groups.

## Supported message types

- **Text messages**: Full support.
- **Images, video, voice, files**: Recognized in the payload, but media delivery is not
  supported.
- **Voice transcription**: When the upstream supplies a transcript, it is forwarded as
  text and flagged as an untrusted transcription.
- **Referenced messages**: The referenced message title is preserved.

## Capabilities

| Feature         | Status                                                  |
| --------------- | ------------------------------------------------------- |
| Direct messages | ✅ Supported                                            |
| Groups          | ⚠️ Supported with policy controls (disabled by default) |
| Media           | ❌ Not supported                                        |
| Reactions       | ❌ Not supported                                        |
| Threads         | ❌ Not supported                                        |
| Polls           | ❌ Not supported                                        |
| Native commands | ❌ Not supported                                        |
| Streaming       | ⚠️ Blocked (final send only)                            |

## Delivery targets (CLI/cron)

- The target is the peer's iLink user id. It is captured automatically on inbound
  messages.
- A leading `weixin:` prefix is stripped.
- Example: `paleoclaw message send --channel weixin --target <ilinkUserId> --message "hi"`.

## Troubleshooting

**Bot doesn't respond:**

- Check that the token and bot id resolve: `paleoclaw channels status --probe`
- Verify the sender is approved (pairing or `allowFrom`)
- Check gateway logs: `paleoclaw logs --follow`

**No messages arrive:**

- Confirm the long poll is running and not rate limited
- A stale session (`ret = -14`) means the login expired; log in with a fresh QR code and
  update `channels.weixin.token`

**Replies are rejected:**

- A reply must echo the peer's `context_token`; if the cache was cleared, wait for a new
  inbound message before sending again

**Long lines are hard to read on a phone:**

- Keep lines under roughly 120 characters so they stay copy-friendly

## Configuration reference (WeChat)

Full configuration: [Configuration](/gateway/configuration)

Provider options:

- `channels.weixin.enabled`: enable/disable channel startup.
- `channels.weixin.botId`: the iLink bot identity id returned by the QR login.
- `channels.weixin.token`: the bot token returned by the QR login.
- `channels.weixin.baseUrl`: iLink API base URL (default: `https://ilinkai.weixin.qq.com`).
- `channels.weixin.cdnBaseUrl`: iLink CDN base URL (default:
  `https://novac2c.cdn.weixin.qq.com/c2c`).
- `channels.weixin.dmPolicy`: `open | pairing | allowlist | disabled` (default: `pairing`).
- `channels.weixin.allowFrom`: DM allowlist (iLink user ids).
- `channels.weixin.groupPolicy`: `open | allowlist | disabled` (default: `disabled`).
- `channels.weixin.groupAllowFrom`: group allowlist.
- `channels.weixin.maxMessageLength`: outbound text split size (default: 2000).

Multi-account options:

- `channels.weixin.accounts.<id>.botId`: per-account bot identity id.
- `channels.weixin.accounts.<id>.token`: per-account bot token.
- `channels.weixin.accounts.<id>.baseUrl`: per-account API base URL.
- `channels.weixin.accounts.<id>.cdnBaseUrl`: per-account CDN base URL.
- `channels.weixin.accounts.<id>.enabled`: enable/disable account.
- `channels.weixin.accounts.<id>.dmPolicy`: per-account DM policy.
- `channels.weixin.accounts.<id>.allowFrom`: per-account DM allowlist.
- `channels.weixin.accounts.<id>.groupPolicy`: per-account group policy.
- `channels.weixin.accounts.<id>.groupAllowFrom`: per-account group allowlist.
- `channels.weixin.accounts.<id>.maxMessageLength`: per-account split size.
