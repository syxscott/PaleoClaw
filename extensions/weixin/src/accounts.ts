/**
 * Account resolution: reads config from channels.weixin, merges per-account
 * overrides, falls back to WEIXIN_* environment variables.
 */

import { DEFAULT_ACCOUNT_ID } from "paleoclaw/plugin-sdk/weixin";
import type { ResolvedWeixinAccount, WeixinChannelConfig } from "./types.js";

export const WEIXIN_DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";
export const WEIXIN_DEFAULT_CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c";
const DEFAULT_MAX_MESSAGE_LENGTH = 2000;

function getChannelConfig(cfg: unknown): WeixinChannelConfig | undefined {
  return (cfg as { channels?: { weixin?: WeixinChannelConfig } } | null | undefined)?.channels
    ?.weixin;
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
}

function parseList(raw: string | string[] | undefined): string[] {
  if (!raw) {
    return [];
  }
  const list = Array.isArray(raw) ? raw : raw.split(",");
  return list.map((item) => item.trim()).filter(Boolean);
}

function parseLength(raw: number | undefined): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0
    ? raw
    : DEFAULT_MAX_MESSAGE_LENGTH;
}

/** List all configured account IDs for this channel. */
export function listWeixinAccountIds(cfg: unknown): string[] {
  const channelCfg = getChannelConfig(cfg);
  if (!channelCfg) {
    return [];
  }
  const ids = new Set<string>();
  if (channelCfg.token || channelCfg.botId || process.env.WEIXIN_TOKEN) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }
  if (channelCfg.accounts) {
    for (const id of Object.keys(channelCfg.accounts)) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}

export function resolveWeixinAccount(
  cfg: unknown,
  accountId?: string | null,
): ResolvedWeixinAccount {
  const channelCfg = getChannelConfig(cfg) ?? {};
  const id = accountId || DEFAULT_ACCOUNT_ID;
  const override = channelCfg.accounts?.[id] ?? {};

  const token = firstNonEmpty(override.token, channelCfg.token, process.env.WEIXIN_TOKEN);
  const botId = firstNonEmpty(override.botId, channelCfg.botId, process.env.WEIXIN_ACCOUNT_ID);

  return {
    accountId: id,
    botId,
    enabled: override.enabled ?? channelCfg.enabled ?? true,
    token,
    baseUrl: firstNonEmpty(override.baseUrl, channelCfg.baseUrl) || WEIXIN_DEFAULT_BASE_URL,
    cdnBaseUrl:
      firstNonEmpty(override.cdnBaseUrl, channelCfg.cdnBaseUrl) || WEIXIN_DEFAULT_CDN_BASE_URL,
    dmPolicy: override.dmPolicy ?? channelCfg.dmPolicy ?? "pairing",
    allowFrom: parseList(override.allowFrom ?? channelCfg.allowFrom),
    groupPolicy: override.groupPolicy ?? channelCfg.groupPolicy ?? "disabled",
    groupAllowFrom: parseList(override.groupAllowFrom ?? channelCfg.groupAllowFrom),
    maxMessageLength: parseLength(override.maxMessageLength ?? channelCfg.maxMessageLength),
    // An iLink account needs BOTH the bot token and the bot identity id.
    configured: Boolean(token && botId),
  };
}
