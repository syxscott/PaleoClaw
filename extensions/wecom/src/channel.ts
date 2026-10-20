/**
 * WeCom (企业微信) channel plugin for paleoclaw.
 *
 * Official self-built app flow (ported from hermes-agent `wecom_callback.py`):
 * inbound = WeCom POSTs encrypted XML to our HTTP endpoint (WXBizMsgCrypt
 * verified + decrypted); outbound = proactive `message/send` via QYAPI with a
 * cached access_token. Follows the synology-chat plugin wiring pattern.
 */

import {
  createScopedPairingAccess,
  DEFAULT_ACCOUNT_ID,
  issuePairingChallenge,
  logInboundDrop,
  readStoreAllowFromForDmPolicy,
  registerPluginHttpRoute,
  resolveControlCommandGate,
  resolveDmGroupAccessWithLists,
  setAccountEnabledInConfigSection,
} from "paleoclaw/plugin-sdk/wecom";
import type { PluginHttpRouteHandler } from "paleoclaw/plugin-sdk/wecom";
import { isWecomSenderAllowed } from "./access.js";
import { listWecomAccountIds, resolveWecomAccount } from "./accounts.js";
import { createWecomCallbackHandler } from "./callback.js";
import { sendWecomMessage, splitContentByBytes, WECOM_MAX_TEXT_BYTES } from "./qyapi.js";
import { getWecomRuntime } from "./runtime.js";
import type { ResolvedWecomAccount } from "./types.js";

const CHANNEL_ID = "wecom";

type WecomRouteEntry = {
  accountId: string;
  path: string;
  handler: PluginHttpRouteHandler;
};

const activeRouteUnregisters = new Map<string, () => void>();
/** Callback path → the account (and handler) that currently owns it. */
const activeRoutes = new Map<string, WecomRouteEntry>();

/** Test seam: the callback routes currently registered by this plugin. */
export function getWecomRegisteredRoutesForTest(): WecomRouteEntry[] {
  return [...activeRoutes.values()];
}

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
          dmPolicy: { type: "string", enum: ["open", "allowlist", "pairing", "disabled"] },
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
                callbackPath: { type: "string" },
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
        if (account.dmPolicy === "pairing") {
          warnings.push(
            '- WeCom: dmPolicy="pairing" requires unknown senders to complete a pairing challenge before the agent answers.',
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
      // WeCom caps one message at 2048 bytes; split long replies instead of
      // letting the server (or a hard cut) drop the tail.
      chunker: (text: string, limit: number) =>
        splitContentByBytes(text, Math.min(limit, WECOM_MAX_TEXT_BYTES)),
      chunkerMode: "text" as const,
      textChunkLimit: WECOM_MAX_TEXT_BYTES,

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
            // Re-resolve the account so dmPolicy / allowFrom edits take effect
            // without waiting for a channel restart.
            const liveAccount = resolveWecomAccount(currentCfg, account.accountId);

            // Group callbacks are not supported yet: replying to the sender
            // would leak the group conversation into that user's DM session.
            if (message.chatType === "group") {
              log?.warn?.(
                `WeCom group message from ${message.fromUserId} ignored (group chat is not supported)`,
              );
              return;
            }

            const senderId = message.fromUserId.trim();
            if (!senderId) {
              log?.warn?.("WeCom message without a sender id ignored");
              return;
            }

            const pairing = createScopedPairingAccess({
              core: rt,
              channel: CHANNEL_ID,
              accountId: liveAccount.accountId,
            });
            const dmPolicy = liveAccount.dmPolicy;
            const storeAllowFrom = await readStoreAllowFromForDmPolicy({
              provider: CHANNEL_ID,
              accountId: liveAccount.accountId,
              dmPolicy,
              readStore: pairing.readStoreForDmPolicy,
            });
            const access = resolveDmGroupAccessWithLists({
              isGroup: false,
              dmPolicy,
              allowFrom: liveAccount.allowFrom,
              storeAllowFrom,
              isSenderAllowed: (list) => isWecomSenderAllowed(list, senderId),
            });

            if (access.decision === "pairing") {
              await issuePairingChallenge({
                channel: CHANNEL_ID,
                senderId,
                senderIdLine: `Your WeCom user id: ${senderId}`,
                meta: { name: senderId },
                upsertPairingRequest: pairing.upsertPairingRequest,
                sendPairingReply: async (text) => {
                  const result = await sendWecomMessage({
                    account: liveAccount,
                    toUser: senderId,
                    content: text,
                  });
                  if (!result.ok) {
                    log?.warn?.(`WeCom pairing reply failed: ${result.error}`);
                  }
                },
                onReplyError: (err) => {
                  log?.warn?.(`WeCom pairing reply failed: ${String(err)}`);
                },
              });
              return;
            }
            if (access.decision !== "allow") {
              logInboundDrop({
                log: (line) => log?.warn?.(line),
                channel: CHANNEL_ID,
                reason: access.reason,
                target: senderId,
              });
              return;
            }

            const rawBody = message.content ?? "";
            const senderAllowedForCommands = isWecomSenderAllowed(
              access.effectiveAllowFrom,
              senderId,
            );
            const commandGate = resolveControlCommandGate({
              useAccessGroups: currentCfg.commands?.useAccessGroups !== false,
              authorizers: [
                {
                  configured: access.effectiveAllowFrom.length > 0,
                  allowed: senderAllowedForCommands,
                },
              ],
              allowTextCommands: rt.channel.commands.shouldHandleTextCommands({
                cfg: currentCfg,
                surface: CHANNEL_ID,
              }),
              hasControlCommand: rt.channel.text.hasControlCommand(rawBody, currentCfg),
            });

            const msgCtx = rt.channel.reply.finalizeInboundContext({
              Body: rawBody,
              RawBody: message.rawXml,
              CommandBody: rawBody,
              From: `${CHANNEL_ID}:${message.fromUserId}`,
              To: `${CHANNEL_ID}:${message.fromUserId}`,
              SessionKey: `${CHANNEL_ID}-${liveAccount.accountId}-${message.fromUserId}`,
              AccountId: liveAccount.accountId,
              OriginatingChannel: CHANNEL_ID,
              OriginatingTo: `${CHANNEL_ID}:${message.fromUserId}`,
              ChatType: "direct",
              SenderName: message.fromUserId,
              SenderId: message.fromUserId,
              Provider: CHANNEL_ID,
              Surface: CHANNEL_ID,
              ConversationLabel: message.fromUserId,
              Timestamp: Date.now(),
              CommandAuthorized: commandGate.commandAuthorized,
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
                  // WeCom caps a single message at 2048 bytes: send the long
                  // reply in several messages instead of losing the tail.
                  for (const chunk of splitContentByBytes(text, WECOM_MAX_TEXT_BYTES)) {
                    const result = await sendWecomMessage({
                      account: liveAccount,
                      toUser: message.fromUserId,
                      content: chunk,
                    });
                    if (!result.ok) {
                      log?.warn?.(`WeCom reply send failed: ${result.error}`);
                    }
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

        // A callback path may only be owned by one account: registering a
        // second handler on the same path would silently replace the first
        // one and break that account's signature verification.
        const pathOwner = activeRoutes.get(account.callbackPath);
        if (pathOwner && pathOwner.accountId !== account.accountId) {
          log?.error?.(
            `WeCom callback path ${account.callbackPath} is already owned by account ${pathOwner.accountId}; ` +
              `refusing to register account ${account.accountId} (set a distinct callbackPath)`,
          );
          return waitUntilAbort(ctx.abortSignal);
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
        activeRoutes.set(account.callbackPath, {
          accountId: account.accountId,
          path: account.callbackPath,
          handler,
        });

        log?.info?.(`Registered WeCom callback route: ${account.callbackPath}`);

        // Keep alive until abort; resolving early would trigger a restart loop.
        return waitUntilAbort(ctx.abortSignal, () => {
          log?.info?.(`Stopping WeCom channel (account: ${accountId})`);
          if (typeof unregister === "function") {
            unregister();
          }
          activeRouteUnregisters.delete(routeKey);
          if (activeRoutes.get(account.callbackPath)?.accountId === account.accountId) {
            activeRoutes.delete(account.callbackPath);
          }
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
