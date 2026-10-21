/**
 * 微信 WeChat channel plugin for paleoclaw — iLink bot bridge.
 *
 * Ported from hermes-agent `gateway/platforms/weixin.py`: a personal WeChat
 * account bridged through Tencent's iLink Bot HTTP API (QR-login bot identity,
 * long-poll getupdates inbound, sendmessage outbound echoing context_token).
 * Follows the synology-chat plugin wiring pattern.
 *
 * STUBBED (behind clean interfaces, documented): CDN media upload/download and
 * typing indicators. The text send/receive path is complete.
 */

import { randomUUID } from "node:crypto";
import {
  createScopedPairingAccess,
  DEFAULT_ACCOUNT_ID,
  resolveControlCommandGate,
  setAccountEnabledInConfigSection,
} from "paleoclaw/plugin-sdk/weixin";
import { resolveWeixinAccount } from "./accounts.js";
import { ContextTokenStore } from "./context-tokens.js";
import { sendMessage } from "./ilink.js";
import { WeixinMonitor } from "./monitor.js";
import { createWeixinOutbound } from "./outbound.js";
import { getWeixinRuntime } from "./runtime.js";
import { normalizeMarkdownBlocks, splitTextForDelivery, wrapCopyFriendlyLines } from "./text.js";
import type { ResolvedWeixinAccount } from "./types.js";

const CHANNEL_ID = "weixin";

function waitUntilAbort(signal?: AbortSignal, onAbort?: () => void): Promise<void> {
  return new Promise((resolve) => {
    const complete = () => {
      onAbort?.();
      resolve();
    };
    if (!signal) {
      return;
    }
    if (signal.aborted) {
      complete();
      return;
    }
    signal.addEventListener("abort", complete, { once: true });
  });
}

export function createWeixinPlugin() {
  return {
    id: CHANNEL_ID,

    meta: {
      id: CHANNEL_ID,
      label: "微信 WeChat",
      selectionLabel: "微信 WeChat (iLink bot)",
      detailLabel: "微信 WeChat (iLink bot 桥接)",
      docsPath: "/channels/weixin",
      docsLabel: "weixin",
      blurb: "微信个人号桥接：iLink bot 扫码登录 + 长轮询收发（context_token 回显）。",
      order: 37,
    },

    capabilities: {
      chatTypes: ["direct" as const],
      media: false, // CDN media upload/download stubbed behind an interface (v1: text only)
      threads: false,
      reactions: false,
      edit: false,
      unsend: false,
      reply: false,
      effects: false,
      blockStreaming: false, // WeChat cannot edit/stream; final-only sends
    },

    reload: { configPrefixes: [`channels.${CHANNEL_ID}`] },

    configSchema: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean" },
          botId: { type: "string" },
          token: { type: "string" },
          baseUrl: { type: "string" },
          cdnBaseUrl: { type: "string" },
          dmPolicy: { type: "string", enum: ["open", "pairing", "allowlist", "disabled"] },
          allowFrom: {
            type: "array",
            items: { oneOf: [{ type: "string" }, { type: "number" }] },
          },
          groupPolicy: { type: "string", enum: ["open", "allowlist", "disabled"] },
          groupAllowFrom: {
            type: "array",
            items: { oneOf: [{ type: "string" }, { type: "number" }] },
          },
          maxMessageLength: { type: "integer", minimum: 1 },
          accounts: {
            type: "object",
            additionalProperties: {
              type: "object",
              additionalProperties: true,
              properties: {
                enabled: { type: "boolean" },
              },
            },
          },
        },
      },
    },

    config: {
      listAccountIds: (cfg: unknown) => {
        const channelCfg = (
          cfg as { channels?: Record<string, { accounts?: Record<string, unknown> }> }
        )?.channels?.[CHANNEL_ID];
        const ids = new Set<string>(["default"]);
        for (const id of Object.keys(channelCfg?.accounts ?? {})) {
          ids.add(id);
        }
        return Array.from(ids);
      },
      resolveAccount: (cfg: unknown, accountId?: string | null) =>
        resolveWeixinAccount(cfg, accountId),
      defaultAccountId: (_cfg: unknown) => DEFAULT_ACCOUNT_ID,
      setAccountEnabled: ({ cfg, accountId, enabled }: any) => {
        const channelConfig = cfg?.channels?.[CHANNEL_ID] ?? {};
        if (accountId === DEFAULT_ACCOUNT_ID) {
          return {
            ...cfg,
            channels: {
              ...cfg.channels,
              [CHANNEL_ID]: { ...channelConfig, enabled },
            },
          };
        }
        return setAccountEnabledInConfigSection({
          cfg,
          sectionKey: `channels.${CHANNEL_ID}`,
          accountId,
          enabled,
        });
      },
    },

    pairing: {
      idLabel: "weixinUserId",
      normalizeAllowEntry: (entry: string) => entry.trim(),
    },

    security: {
      collectWarnings: ({ account }: { account: ResolvedWeixinAccount }) => {
        const warnings: string[] = [];
        if (!account.token || !account.botId) {
          warnings.push(
            "- Weixin: token/botId are not configured. Scan the iLink QR code (qrLogin) to obtain both.",
          );
        }
        if (account.groupPolicy !== "disabled") {
          warnings.push(
            "- Weixin: the iLink bot identity typically cannot be invited into ordinary WeChat groups; group delivery may never arrive (iLink-side limitation).",
          );
        }
        if (account.dmPolicy === "open") {
          warnings.push(
            '- Weixin: dmPolicy="open" allows anyone messaging the bot to trigger the agent.',
          );
        }
        return warnings;
      },
    },

    messaging: {
      normalizeTarget: (target: string) => {
        const trimmed = target.trim();
        if (!trimmed) {
          return undefined;
        }
        return trimmed.replace(/^weixin:/i, "").trim();
      },
      targetResolver: {
        looksLikeId: (id: string) => /^[0-9a-zA-Z@_.-]+$/.test(id?.trim() ?? ""),
        hint: "<ilinkUserId>",
      },
    },

    directory: {
      self: async () => null,
      listPeers: async () => [],
      listGroups: async () => [],
    },

    outbound: {
      deliveryMode: "gateway" as const,
      textChunkLimit: 2000,
      ...createWeixinOutbound(),
    },

    gateway: {
      startAccount: async (ctx: any) => {
        const { cfg, accountId, log } = ctx;
        const account: ResolvedWeixinAccount = resolveWeixinAccount(cfg, accountId);

        if (!account.enabled) {
          log?.info?.(`Weixin account ${accountId} is disabled, skipping`);
          return waitUntilAbort(ctx.abortSignal);
        }
        if (!account.configured) {
          log?.warn?.(
            `Weixin account ${accountId} not configured (missing token/botId from QR login); monitor not started`,
          );
          return waitUntilAbort(ctx.abortSignal);
        }

        log?.info?.(`Starting Weixin channel (account: ${accountId}, bot: ${account.botId})`);

        // Disk-backed context_token cache (required to echo on every reply).
        const storeRoot = `${process.env.OPENCLAW_STATE_DIR ?? ".paleoclaw"}/weixin`;
        const contextTokens = new ContextTokenStore(storeRoot);
        await contextTokens.restore(account.accountId);

        const rt = getWeixinRuntime();
        const pairing = createScopedPairingAccess({
          core: rt,
          channel: CHANNEL_ID,
          accountId: account.accountId,
        });

        const monitor = new WeixinMonitor({
          account,
          contextTokens,
          pairing: {
            readStoreForDmPolicy: pairing.readStoreForDmPolicy,
            upsertPairingRequest: pairing.upsertPairingRequest,
          },
          log: {
            info: (msg: unknown) => log?.info?.(String(msg)),
            warn: (msg: unknown) => log?.warn?.(String(msg)),
            error: (msg: unknown) => log?.error?.(String(msg)),
          },
          deliver: async (message, access) => {
            const currentCfg = rt.config.current({ clone: true });
            // Owner-level command authorization mirrors the access decision:
            // only a sender on the effective allowlist may run control commands.
            const commandAuthorized = resolveControlCommandGate({
              useAccessGroups: currentCfg.commands?.useAccessGroups !== false,
              authorizers: [
                {
                  configured:
                    (message.chatType === "group"
                      ? access.effectiveGroupAllowFrom
                      : access.effectiveAllowFrom
                    ).length > 0,
                  allowed: access.senderAllowed,
                },
              ],
              allowTextCommands: rt.channel.commands.shouldHandleTextCommands({
                cfg: currentCfg,
                surface: CHANNEL_ID,
              }),
              hasControlCommand: rt.channel.text.hasControlCommand(message.text, currentCfg),
            }).commandAuthorized;
            const msgCtx = rt.channel.reply.finalizeInboundContext({
              Body: message.text,
              RawBody: JSON.stringify(message.raw),
              CommandBody: message.text.startsWith("/") ? message.text : "",
              From: `${CHANNEL_ID}:${message.senderId}`,
              To: `${CHANNEL_ID}:${message.chatId}`,
              SessionKey: `${CHANNEL_ID}-${account.accountId}-${message.chatId}`,
              AccountId: account.accountId,
              OriginatingChannel: CHANNEL_ID,
              OriginatingTo: `${CHANNEL_ID}:${message.chatId}`,
              ChatType: message.chatType === "group" ? "group" : "direct",
              SenderName: message.senderId,
              SenderId: message.senderId,
              Provider: CHANNEL_ID,
              Surface: CHANNEL_ID,
              ConversationLabel: message.chatId,
              Timestamp: Date.now(),
              CommandAuthorized: commandAuthorized,
            });
            await rt.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
              ctx: msgCtx,
              cfg: currentCfg,
              dispatcherOptions: {
                deliver: async (payload: { text?: string; body?: string }) => {
                  const text = payload?.text ?? payload?.body;
                  if (!text) {
                    return;
                  }
                  const formatted = wrapCopyFriendlyLines(normalizeMarkdownBlocks(text));
                  const chunks = splitTextForDelivery(formatted, account.maxMessageLength);
                  for (const chunk of chunks) {
                    const result = await sendMessage({
                      baseUrl: account.baseUrl,
                      token: account.token,
                      to: message.chatId,
                      text: chunk,
                      contextToken: contextTokens.get(account.accountId, message.chatId) ?? null,
                      clientId: `paleoclaw-weixin-${Date.now()}-${randomUUID().slice(0, 8)}`,
                    });
                    const ret = result.ret ?? 0;
                    const errcode = result.errcode ?? 0;
                    if (ret !== 0 || errcode !== 0) {
                      log?.warn?.(
                        `weixin: sendmessage failed ret=${ret} errcode=${errcode} (${JSON.stringify(result)})`,
                      );
                    }
                  }
                },
                onReplyStart: () => {
                  log?.info?.(`Agent reply started for ${message.chatId}`);
                },
              },
            });
          },
        });

        const startPromise = monitor.start().catch((error: unknown) => {
          log?.error?.(`weixin: monitor crashed: ${String(error)}`);
        });
        void startPromise;

        // Keep alive until abort; resolving early would trigger a restart loop.
        return waitUntilAbort(ctx.abortSignal, async () => {
          log?.info?.(`Stopping Weixin channel (account: ${accountId})`);
          await monitor.stop();
        });
      },

      stopAccount: async (ctx: any) => {
        ctx.log?.info?.(`Weixin account ${ctx.accountId} stopped`);
      },
    },

    agentPrompt: {
      messageToolHints: () => [
        "- Weixin targeting: the target is the peer's iLink user id (captured automatically on inbound).",
        "- WeChat renders fenced code blocks; keep lines under ~120 chars for copy-friendliness.",
      ],
    },
  };
}
