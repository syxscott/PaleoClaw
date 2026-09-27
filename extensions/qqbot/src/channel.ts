/**
 * QQ 机器人 channel plugin — QQ open platform official bot over the WebSocket
 * gateway (inbound) + REST API (outbound), ported from the Hermes-Agent
 * reference adapter.
 */

import {
  buildBaseAccountStatusSnapshot,
  buildChannelConfigSchema,
  buildBaseChannelStatusSummary,
  DEFAULT_ACCOUNT_ID,
  type ChannelPlugin,
} from "paleoclaw/plugin-sdk/qqbot";
import {
  DEFAULT_QQBOT_ACCOUNT_ID,
  isDmIntakeAllowed,
  isGroupAllowed,
  listQqbotAccountIds,
  resolveDefaultQqbotAccountId,
  resolveQqbotAccount,
} from "./accounts.js";
import { QqbotConfigSchema } from "./config-schema.js";
import { monitorQqbotProvider } from "./monitor.js";
import { probeQqbot } from "./probe.js";
import { getQqbotRuntime } from "./runtime.js";
import { getQqbotAccountContext } from "./send.js";
import type { CoreConfig, ResolvedQqbotAccount } from "./types.js";

export function normalizeQqbotMessagingTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/^(qqbot|qq):/i, "").trim() || undefined;
}

function looksLikeQqbotTargetId(raw: string): boolean {
  const normalized = normalizeQqbotMessagingTarget(raw);
  if (!normalized) {
    return false;
  }
  // QQ open ids are base64-ish opaque strings; channel ids are numeric-ish.
  return /^[A-Za-z0-9_-]{6,}$/.test(normalized);
}

export const qqbotPlugin: ChannelPlugin<ResolvedQqbotAccount> = {
  id: "qqbot",
  meta: {
    id: "qqbot",
    label: "QQ 机器人",
    selectionLabel: "QQ 机器人 (官方 WebSocket)",
    docsPath: "/channels/qqbot",
    docsLabel: "qqbot",
    blurb: "QQ 开放平台官方机器人：WebSocket 网关 + REST API。",
    aliases: ["qq"],
    order: 96,
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    threads: false,
    reactions: false,
    edit: false,
    unsend: false,
    reply: true,
    effects: false,
    blockStreaming: false,
  },
  reload: { configPrefixes: ["channels.qqbot"] },
  configSchema: buildChannelConfigSchema(QqbotConfigSchema),
  config: {
    listAccountIds: (cfg) => listQqbotAccountIds(cfg as CoreConfig),
    resolveAccount: (cfg, accountId) => resolveQqbotAccount({ cfg: cfg as CoreConfig, accountId }),
    defaultAccountId: (cfg) => resolveDefaultQqbotAccountId(cfg as CoreConfig),
    setAccountEnabled: ({ cfg, enabled }) => {
      const channels = (cfg.channels ?? {}) as Record<string, unknown>;
      const section = (channels.qqbot ?? {}) as Record<string, unknown>;
      return {
        ...cfg,
        channels: {
          ...channels,
          qqbot: { ...section, enabled },
        },
      } as typeof cfg;
    },
    deleteAccount: ({ cfg, accountId }) => {
      if (accountId !== DEFAULT_ACCOUNT_ID) {
        const section = (cfg.channels as Record<string, unknown> | undefined)?.qqbot as
          | { accounts?: Record<string, unknown> }
          | undefined;
        const accounts = { ...(section?.accounts ?? {}) };
        delete accounts[accountId];
        return {
          ...cfg,
          channels: {
            ...(cfg.channels as Record<string, unknown>),
            qqbot: { ...(section ?? {}), accounts },
          },
        } as typeof cfg;
      }
      const nextChannels = { ...(cfg.channels as Record<string, unknown>) };
      delete nextChannels.qqbot;
      return { ...cfg, channels: nextChannels } as typeof cfg;
    },
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      appId: account.appId ? `${account.appId.slice(0, 4)}***` : "",
      sandbox: account.sandbox,
      mode: account.mode,
      dmPolicy: account.dmPolicy,
      groupPolicy: account.groupPolicy,
      secretSource: account.secretSource,
    }),
    resolveAllowFrom: ({ cfg }) => resolveQqbotAccount({ cfg: cfg as CoreConfig }).allowFrom,
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean),
    resolveDefaultTo: ({ cfg }) => resolveQqbotAccount({ cfg: cfg as CoreConfig }).defaultTo,
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => ({
      policy: account.dmPolicy,
      allowFrom: account.allowFrom,
      policyPath: `channels.qqbot${accountId && accountId !== DEFAULT_QQBOT_ACCOUNT_ID ? `.accounts.${accountId}` : ""}.dmPolicy`,
      allowFromPath: `channels.qqbot${accountId && accountId !== DEFAULT_QQBOT_ACCOUNT_ID ? `.accounts.${accountId}` : ""}.allowFrom`,
      approveHint: "paleoclaw pairing approve qqbot <openid>",
      normalizeEntry: (raw: string) => raw.trim().toLowerCase(),
    }),
    collectWarnings: ({ account }) => {
      const warnings: string[] = [];
      if (!account.configured) {
        warnings.push(
          "- QQBot: appId/appSecret not configured (channels.qqbot.appId + appSecret, or QQ_APP_ID/QQ_APP_SECRET).",
        );
      }
      if (account.dmPolicy === "open") {
        warnings.push(
          '- QQBot: dmPolicy="open" lets any QQ user DM the bot. Prefer "allowlist" with allowFrom (openid) in production.',
        );
      }
      if (account.groupPolicy === "open") {
        warnings.push(
          '- QQBot: groupPolicy="open" lets any group add the bot. Prefer "allowlist" with groupAllowFrom (group_openid).',
        );
      }
      if (account.sandbox) {
        warnings.push(
          "- QQBot: sandbox=true points REST calls at sandbox.api.sgroup.qq.com; only sandbox-visible bots can be addressed.",
        );
      }
      return warnings;
    },
  },
  messaging: {
    normalizeTarget: normalizeQqbotMessagingTarget,
    targetResolver: {
      looksLikeId: looksLikeQqbotTargetId,
      hint: "<user_openid|group_openid|channel_id>",
    },
  },
  pairing: {
    idLabel: "qqbotUserId",
    normalizeAllowEntry: (entry) => entry.trim().toLowerCase(),
    notifyApproval: async ({ cfg, id }) => {
      const account = resolveQqbotAccount({ cfg: cfg as CoreConfig });
      if (!account.configured) {
        throw new Error("QQBot is not configured; cannot send pairing approval");
      }
      const context = getQqbotAccountContext(account);
      await context.sendText({ chatId: id, text: "paleoclaw: your access has been approved." });
    },
  },
  agentPrompt: {
    messageToolHints: () => [
      "- QQ 官方机器人: passive replies require the inbound msg_id (replyTo). Text is sent as markdown payload by default (msg_type 2).",
      "- Outbound targets are opaque openids: user_openid (DM), group_openid (group), or channel_id (guild).",
      "- Media (image/video/voice/file) is uploaded via the QQ files API first; URL sources are fetched server-side by QQ.",
      "- Keyboards: pass a raw QQ keyboard DSL object via `keyboard`; no builder is provided.",
      "- QQ does not support editing or unsending messages; keep replies under 4000 chars.",
    ],
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getQqbotRuntime().channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
    textChunkLimit: 4000,
    sendText: async ({ cfg, to, text, accountId, replyToId }) => {
      const account = resolveQqbotAccount({ cfg: cfg as CoreConfig, accountId });
      if (!account.configured) {
        throw new Error("QQBot is not configured (appId + appSecret/clientSecret)");
      }
      const context = getQqbotAccountContext(account);
      const result = await context.sendText({
        chatId: to,
        text,
        replyTo: replyToId ?? undefined,
      });
      return { channel: "qqbot", messageId: result.messageId, chatId: to };
    },
    sendMedia: async ({ cfg, to, text, mediaUrl, accountId, replyToId }) => {
      const account = resolveQqbotAccount({ cfg: cfg as CoreConfig, accountId });
      if (!account.configured) {
        throw new Error("QQBot is not configured (appId + appSecret/clientSecret)");
      }
      if (!mediaUrl) {
        throw new Error("No media URL provided for QQBot sendMedia");
      }
      const context = getQqbotAccountContext(account);
      const result = await context.sendMedia({
        chatId: to,
        mediaUrl,
        caption: text || undefined,
        replyTo: replyToId ?? undefined,
      });
      return { channel: "qqbot", messageId: result.messageId, chatId: to };
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_QQBOT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      ...buildBaseChannelStatusSummary(snapshot),
      sandbox: (snapshot as { sandbox?: boolean }).sandbox ?? false,
    }),
    probeAccount: async ({ cfg, account }) =>
      probeQqbot(cfg as CoreConfig, { accountId: account.accountId }),
    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      ...buildBaseAccountStatusSnapshot({ account, runtime, probe }),
      appId: account.appId ? `${account.appId.slice(0, 4)}***` : "",
      sandbox: account.sandbox,
      mode: account.mode,
      dmPolicy: account.dmPolicy,
      groupPolicy: account.groupPolicy,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const account =
        ctx.account ??
        resolveQqbotAccount({ cfg: ctx.cfg as CoreConfig, accountId: ctx.accountId });
      if (!account.configured) {
        throw new Error(
          `QQBot is not configured for account "${ctx.accountId}" (need appId + appSecret/clientSecret).`,
        );
      }
      ctx.log?.info?.(`[qqbot] starting provider (account ${ctx.accountId})`);
      const { stop } = await monitorQqbotProvider({
        accountId: ctx.accountId,
        config: ctx.cfg as CoreConfig,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        statusSink: (patch) => ctx.setStatus({ accountId: ctx.accountId, ...patch }),
      });
      return { stop };
    },
  },
};

export function isQqbotSenderAllowed(
  account: ResolvedQqbotAccount,
  params: { chatKind: string; chatId: string; senderId: string },
): boolean {
  const isGroupLike = params.chatKind === "group" || params.chatKind === "guild";
  return isGroupLike
    ? isGroupAllowed(account, params.chatId)
    : isDmIntakeAllowed(account, params.senderId);
}
