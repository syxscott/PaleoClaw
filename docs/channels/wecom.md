---
summary: "WeCom self-built app callback setup, config, and usage"
read_when:
  - Working on WeCom features or encrypted callbacks
  - You need WeCom credential and callback URL setup
  - You want WeCom-specific message options
title: "WeCom"
---

# WeCom (Self-Built App)

WeCom connects to paleoclaw through a self-built application (自建应用). The plugin
receives messages on an encrypted callback URL and sends replies through the WeCom
`message/send` API.

Status: supported via plugin. Direct messages are supported. Media, group handling, and
message editing are not supported.

## Plugin required

WeCom ships as a plugin and is not bundled with the core install.

- Install via CLI: `paleoclaw plugins install @paleoclaw/wecom`
- Or select **企业微信 WeCom (自建应用回调)** during onboarding and confirm the install prompt
- Details: [Plugins](/tools/plugin)

Local checkout (when running from a git repo):

```bash
paleoclaw plugins install ./extensions/wecom
```

## Quick setup (beginner)

1. Install the WeCom plugin (see above).
2. Create a self-built app in the WeCom admin console and note its **CorpID**, **AgentID**,
   and **Secret**.
3. In the app's "接收消息" (receive message) settings, enable the callback and copy the
   **Token** and **EncodingAESKey** that WeCom generates for you.
4. Point the callback URL at your gateway:
   `https://gateway-host/wecom/callback`
5. Configure the credentials (see below) and restart the gateway.

Minimal config:

```json5
{
  channels: {
    wecom: {
      enabled: true,
      corpId: "ww0000000000000000",
      agentId: "1000002",
      secret: "your-app-secret",
      token: "your-callback-token",
      encodingAesKey: "your-encoding-aes-key",
      dmPolicy: "allowlist",
    },
  },
}
```

## What it is

A WeCom self-built app posts encrypted XML to a callback URL that you expose. The plugin
verifies the signature, decrypts the payload, and hands the message to the agent. Replies
are sent back with the proactive `message/send` API rather than as a callback response,
because the agent usually needs longer than WeCom's acknowledgement window.

- A WeCom self-built app channel owned by the Gateway.
- Deterministic routing: replies go back to the member who wrote in.
- One callback route per account.
- Requires a publicly reachable HTTPS callback URL.

## Setup (fast path)

### 1) Create the self-built app (WeCom admin console)

1. Open the WeCom admin console and go to **应用管理 → 自建**.
2. Create an application and note the **AgentId** and **Secret**.
3. The **CorpId** is shown under **我的企业 → 企业信息**.

### 2) Configure the callback

1. In the app settings, open **接收消息 → 设置接收消息 API**.
2. WeCom shows a **Token** and an **EncodingAESKey** you choose or accept.
3. Set the callback URL to your gateway path:

```
https://gateway-host/wecom/callback
```

4. Save. WeCom immediately performs a URL verification request (a GET with
   `msg_signature`, `timestamp`, `nonce`, and `echostr`); the plugin decrypts `echostr`
   and answers with the plaintext.

To use a different path, set `channels.wecom.callbackPath` (or the per-account
`callbackPath`) and update the URL in the WeCom console accordingly. The default account
keeps `/wecom/callback`; a named account defaults to `/wecom/callback/<accountId>` so
that two accounts never claim the same route.

### 3) Configure the credentials (env or config)

```json5
{
  channels: {
    wecom: {
      enabled: true,
      corpId: "ww0000000000000000",
      agentId: "1000002",
      secret: "your-app-secret",
      token: "your-callback-token",
      encodingAesKey: "your-encoding-aes-key",
      callbackPath: "/wecom/callback",
      dmPolicy: "allowlist",
      allowFrom: ["member-user-id"],
      outboundMsgType: "text",
    },
  },
}
```

Env options (default account only):

- `WECOM_CORP_ID`
- `WECOM_SECRET`
- `WECOM_TOKEN`
- `WECOM_ENCODING_AES_KEY`
- `WECOM_AGENT_ID`

All five values are required for the account to be considered configured. The callback
route is only registered when `corpId`, `token`, and `encodingAesKey` are present.

### 4) Restart the gateway

Check that the route was registered and the credentials work:

```bash
paleoclaw channels status --probe
paleoclaw logs --follow
```

## How it works (behavior)

- The plugin registers an HTTP route on the gateway for `channels.wecom.callbackPath`.
- Inbound requests are signature-verified and decrypted with the WXBizMsgCrypt scheme
  (`token`, `encodingAesKey`, `corpId`) before anything is parsed.
- The callback is acknowledged immediately with `success`, as WeCom requires a fast 2xx;
  the agent runs afterwards.
- Duplicate callbacks (same `MsgId`) are ignored for a short replay window.
- Replies are delivered through `message/send` with a cached `access_token` that is
  refreshed 60 seconds before it expires.
- Plain text is sent by default. Set `channels.wecom.outboundMsgType: "markdown"` to send
  a markdown payload instead.

## Limits

- WeCom caps one message at 2048 bytes. Longer replies are split into several messages
  instead of losing the tail.
- Media is not supported; the plugin declares no media capability.
- Callback request bodies are capped at 1 MB.
- Group messages are ignored. Replying to the sender would leak the group conversation
  into that person's direct-message session, so the message is dropped with a warning.

## Access control (DMs)

- `channels.wecom.dmPolicy` controls who may talk to the app:
  `open | allowlist | pairing | disabled`.
- Default: `allowlist`.
- `channels.wecom.allowFrom` holds the WeCom member ids that are allowed to message the
  bot. With `allowlist` and an empty `allowFrom`, every sender is blocked.
- With `pairing`, an unknown sender has to complete a pairing challenge before the agent
  answers.
- Approve a sender interactively with:
  - `paleoclaw pairing list wecom`
  - `paleoclaw pairing approve wecom <code>`
- Pairing details: [Pairing](/channels/pairing)

## Supported message types

- **Text messages**: Full support.
- **Markdown**: Optional via `outboundMsgType`.
- **Images**: Recognized in the callback payload, but media delivery is not supported.
- **Voice**: The callback payload carries a recognition transcript, which is forwarded as
  text.
- **Events**: Non-message events are forwarded as an intake message.

## Capabilities

| Feature         | Status                        |
| --------------- | ----------------------------- |
| Direct messages | ✅ Supported                  |
| Groups          | ❌ Not supported              |
| Media           | ❌ Not supported              |
| Reactions       | ❌ Not supported              |
| Threads         | ❌ Not supported              |
| Polls           | ❌ Not supported              |
| Native commands | ❌ Not supported              |
| Streaming       | ⚠️ Buffered (final send only) |

## Delivery targets (CLI/cron)

- The target is the member's WeCom user id.
- A leading `wecom:` prefix is stripped.
- Example: `paleoclaw message send --channel wecom --target <userId> --message "hi"`.

## Troubleshooting

**Bot doesn't respond:**

- Check that all five credentials resolve: `paleoclaw channels status --probe`
- Verify the sender is in `allowFrom` (or set `dmPolicy: "open"` for a test)
- Check gateway logs: `paleoclaw logs --follow`

**WeCom reports the callback URL as invalid:**

- The URL must be reachable over HTTPS from the public internet
- `token` and `encodingAesKey` in the config must match the values in the WeCom console
- `corpId` must match the company that owns the app

**Callback returns HTTP 400:**

- The payload failed signature verification or decryption; check for a mismatched
  `encodingAesKey`
- The body may exceed the 1 MB limit

**Replies arrive split up:**

- WeCom caps one message at 2048 bytes, so a long answer is delivered as several
  messages. Keep the answer short if you want it in a single bubble.

## Configuration reference (WeCom)

Full configuration: [Configuration](/gateway/configuration)

Provider options:

- `channels.wecom.enabled`: enable/disable channel startup.
- `channels.wecom.corpId`: the enterprise id of the WeCom company.
- `channels.wecom.agentId`: the id of the self-built app.
- `channels.wecom.secret`: the app secret used to obtain an `access_token`.
- `channels.wecom.token`: the callback token used for signature verification.
- `channels.wecom.encodingAesKey`: the callback AES key used for decryption.
- `channels.wecom.callbackPath`: callback path on the gateway HTTP server (default:
  `/wecom/callback`).
- `channels.wecom.dmPolicy`: `open | allowlist | pairing | disabled` (default:
  `allowlist`).
- `channels.wecom.allowFrom`: allowlisted member ids.
- `channels.wecom.outboundMsgType`: outbound payload type, `text | markdown` (default:
  `text`).

Multi-account options:

- `channels.wecom.accounts.<id>.corpId`: per-account enterprise id.
- `channels.wecom.accounts.<id>.agentId`: per-account app id.
- `channels.wecom.accounts.<id>.secret`: per-account app secret.
- `channels.wecom.accounts.<id>.token`: per-account callback token.
- `channels.wecom.accounts.<id>.encodingAesKey`: per-account callback AES key.
- `channels.wecom.accounts.<id>.callbackPath`: per-account callback path.
- `channels.wecom.accounts.<id>.enabled`: enable/disable account.
- `channels.wecom.accounts.<id>.dmPolicy`: per-account DM policy.
- `channels.wecom.accounts.<id>.allowFrom`: per-account allowlist.
- `channels.wecom.accounts.<id>.outboundMsgType`: per-account outbound payload type.
