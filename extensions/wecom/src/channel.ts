/**
 * WeCom (企业微信) channel plugin for paleoclaw.
 *
 * Official self-built app flow (ported from hermes-agent `wecom_callback.py`):
 * inbound = WeCom POSTs encrypted XML to our HTTP endpoint (WXBizMsgCrypt
 * verified + decrypted); outbound = proactive `message/send` via QYAPI with a
 * cached access_token. Follows the synology-chat plugin wiring pattern.
 */

import {
  DEFAULT_ACCOUNT_ID,
  registerPluginHttpRoute,
  setAccountEnabledInConfigSection,
} from "paleoclaw/plugin-sdk/wecom";
import { listWecomAccountIds, resolveWecomAccount } from "./accounts.js";
import { createWecomCallbackHandler } from "./callback.js";
import { sendWecomMessage } from "./qyapi.js";
import { getWecomRuntime } from "./runtime.js";
import type { ResolvedWecomAccount } from "./types.js";

const CHANNEL_ID = "wecom";

const activeRouteUnregisters = new Map<string, () => void>();

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

export function createWecomPlugin() {
  return {
    id: CHANNEL_ID,

    meta: {
      id: CHANNEL_ID,
      label: "企业微信 WeCom",
      selectionLabel: "企业微信 WeCom (自建应用)",
      detailLabel: "企业微信 WeCom (自建应用回调)",
      docsPath: "/channels/wecom",
      docsLabel: "wecom",
      blurb: "企业微信自建应用：WXBizMsgCrypt 加密回调 + QYAPI 主动发送。",
      order: 36,
    },

    capabilities: {
      chatTypes: ["direct" as const],
      media: false,
      threads: false,
      reactions: false,
      edit: false,
      unsend: false,
      reply: false,
      effects: false,
      blockStreaming: false,
    },

    reload: { configPrefixes: [`channels.${CHANNEL_ID}`] },

    configSchema: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean" },
          corpId: { type: "string" },
          agentId: { type: ["string", "integer"] },
          secret: { type: "string" },
          token: { type: "string" },
          encodingAesKey: { type: "string" },
          callbackPath: { type: "string" },
          dmPolicy: { type: "string", enum: ["open", "allowlist", "disabled"] },
          allowFrom: {
            type: "array",
            items: { oneOf: [{ type: "string" }, { type: "number" }] },
          },
          outboundMsgType: { type: "string", enum: ["text", "markdown"] },
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
      listAccountIds: (cfg: unknown) => listWecomAccountIds(cfg),
      resolveAccount: (cfg: unknown, accountId?: string | null) =>
        resolveWecomAccount(cfg, accountId),
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
      idLabel: "wecomUserId",
      normalizeAllowEntry: (entry: string) => entry.trim(),
    },

    security: {
      resolveDmPolicy: ({
        cfg,
        accountId,
        account,
      }: {
        cfg: any;
        accountId?: string | null;
        account: ResolvedWecomAccount;
      }) => {
        const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
        const channelCfg = cfg?.channels?.[CHANNEL_ID];
        const useAccountPath = Boolean(channelCfg?.accounts?.[resolvedAccountId]);
        const basePath = useAccountPath
          ? `channels.${CHANNEL_ID}.accounts.${resolvedAccountId}.`
          : `channels.${CHANNEL_ID}.`;
        return {
          policy: account.dmPolicy ?? "allowlist",
          allowFrom: account.allowFrom ?? [],
          policyPath: `${basePath}dmPolicy`,
          allowFromPath: `${basePath}allowFrom`,
          approveHint: `paleoclaw pairing approve ${CHANNEL_ID} <userId>`,
          normalizeEntry: (raw: string) => raw.trim(),
        };
      },
      collectWarnings: ({ account }: { account: ResolvedWecomAccount }) => {
        const warnings: string[] = [];
        if (!account.corpId || !account.secret || !account.agentId) {
          warnings.push(
            "- WeCom: corpId/secret/agentId are not fully configured; proactive replies will fail.",
          );
        }
        if (!account.token || !account.encodingAesKey) {
          warnings.push(
            "- WeCom: token/encodingAesKey are not configured; the callback URL cannot verify or decrypt WeCom requests.",
          );
        }
        if (account.dmPolicy === "open") {
          warnings.push(
            '- WeCom: dmPolicy="open" allows any enterprise member to message the bot. Consider "allowlist".',
          );
        }
        if (account.dmPolicy === "allowlist" && account.allowFrom.length === 0) {
          warnings.push(
            '- WeCom: dmPolicy="allowlist" with empty allowFrom blocks all senders. Add user ids or set dmPolicy="open".',
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
        return trimmed.replace(/^wecom:/i, "").trim();
      },
      targetResolver: {
        looksLikeId: (id: string) => Boolean(id?.trim()),
        hint: "<WeChat userId>",
      },
    },

    directory: {
      self: async () => null,
      listPeers: async () => [],
      listGroups: async () => [],
    },

    outbound: {
      deliveryMode: "gateway" as const,
      textChunkLimit: 2048,

      sendText: async ({ to, text, accountId, cfg }: any) => {
        const account = resolveWecomAccount(cfg ?? {}, accountId);
        if (!account.configured) {
          throw new Error("WeCom account is not fully configured (corpId/secret/agentId required)");
        }
        const result = await sendWecomMessage({ account, toUser: to, content: text });
        if (!result.ok) {
          throw new Error(result.error);
        }
        return { channel: CHANNEL_ID, messageId: result.messageId, chatId: to };
      },
    },

    gateway: {
      startAccount: async (ctx: any) => {
        const { cfg, accountId, log } = ctx;
        const account: ResolvedWecomAccount = resolveWecomAccount(cfg, accountId);

        if (!account.enabled) {
          log?.info?.(`WeCom account ${accountId} is disabled, skipping`);
          return waitUntilAbort(ctx.abortSignal);
        }
        if (!account.token || !account.encodingAesKey || !account.corpId) {
          log?.warn?.(
            `WeCom account ${accountId} not fully configured (corpId/token/encodingAesKey); callback route not registered`,
          );
          return waitUntilAbort(ctx.abortSignal);
        }

        log?.info?.(
          `Starting WeCom channel (account: ${accountId}, path: ${account.callbackPath}, msgtype: ${account.outboundMsgType})`,
        );

        const { handler } = createWecomCallbackHandler({
          account,
          deliver: async (message) => {
            const rt = getWecomRuntime();
            const currentCfg = await rt.config.loadConfig();
            const msgCtx = rt.channel.reply.finalizeInboundContext({
              Body: message.content ?? "",
              RawBody: message.rawXml,
              CommandBody: message.content ?? "",
              From: `${CHANNEL_ID}:${message.fromUserId}`,
              To: `${CHANNEL_ID}:${message.fromUserId}`,
              SessionKey: `${CHANNEL_ID}-${account.accountId}-${message.fromUserId}`,
              AccountId: account.accountId,
              OriginatingChannel: CHANNEL_ID,
              OriginatingTo: `${CHANNEL_ID}:${message.fromUserId}`,
              ChatType: "direct",
              SenderName: message.fromUserId,
              SenderId: message.fromUserId,
              Provider: CHANNEL_ID,
              Surface: CHANNEL_ID,
              ConversationLabel: message.fromUserId,
              Timestamp: Date.now(),
              CommandAuthorized: false,
            });
            await rt.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
              ctx: msgCtx,
              cfg: currentCfg,
              dispatcherOptions: {
                deliver: async (payload: { text?: string; body?: string }) => {
                  const text = payload?.text ?? payload?.body;
                  if (!text || !message.fromUserId) {
                    return;
                  }
                  const result = await sendWecomMessage({
                    account,
                    toUser: message.fromUserId,
                    content: text,
                  });
                  if (!result.ok) {
                    log?.warn?.(`WeCom reply send failed: ${result.error}`);
                  }
                },
                onReplyStart: () => {
                  log?.info?.(`Agent reply started for ${message.fromUserId}`);
                },
              },
            });
          },
          log: {
            info: (msg: unknown) => log?.info?.(String(msg)),
            warn: (msg: unknown) => log?.warn?.(String(msg)),
            error: (msg: unknown) => log?.error?.(String(msg)),
          },
        });

        // Deregister any stale route from a previous start (e.g. on auto-restart).
        const routeKey = `${accountId}:${account.callbackPath}`;
        const prevUnregister = activeRouteUnregisters.get(routeKey);
        if (prevUnregister) {
          prevUnregister();
          activeRouteUnregisters.delete(routeKey);
        }

        const unregister = registerPluginHttpRoute({
          path: account.callbackPath,
          auth: "plugin",
          replaceExisting: true,
          pluginId: CHANNEL_ID,
          accountId: account.accountId,
          log: (msg: string) => log?.info?.(msg),
          handler,
        });
        activeRouteUnregisters.set(routeKey, unregister);

        log?.info?.(`Registered WeCom callback route: ${account.callbackPath}`);

        // Keep alive until abort; resolving early would trigger a restart loop.
        return waitUntilAbort(ctx.abortSignal, () => {
          log?.info?.(`Stopping WeCom channel (account: ${accountId})`);
          if (typeof unregister === "function") {
            unregister();
          }
          activeRouteUnregisters.delete(routeKey);
        });
      },

      stopAccount: async (ctx: any) => {
        ctx.log?.info?.(`WeCom account ${ctx.accountId} stopped`);
      },
    },

    agentPrompt: {
      messageToolHints: () => [
        "- WeCom targeting: omit `target` to reply to the current conversation; explicit target is the member's WeChat userid.",
        "- WeCom text messages are plain text; set channels.wecom.outboundMsgType=markdown to render markdown.",
      ],
    },
  };
}
