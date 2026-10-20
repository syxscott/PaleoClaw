/**
 * Account resolution: reads config from channels.wecom,
 * merges per-account overrides, falls back to environment variables.
 */

import { DEFAULT_ACCOUNT_ID } from "paleoclaw/plugin-sdk/wecom";
import type { ResolvedWecomAccount, WecomChannelConfig } from "./types.js";

const DEFAULT_CALLBACK_PATH = "/wecom/callback";

/** Make an account id safe to use as a single URL path segment. */
function toPathSegment(value: string): string {
  const cleaned = value.trim().replace(/[^A-Za-z0-9._-]+/g, "_");
  return cleaned || "account";
}

/**
 * Resolve the callback path for an account.
 *
 * An explicit `callbackPath` always wins. Otherwise the default path is
 * account-scoped so that two accounts never resolve to the same route (the
 * HTTP registry replaces an existing route, which would silently kill the
 * first account). The default account keeps the historical path so existing
 * WeCom console configurations keep working.
 */
export function resolveWecomCallbackPath(accountId: string, explicit?: string): string {
  const trimmed = explicit?.trim();
  if (trimmed) {
    return trimmed;
  }
  if (accountId === DEFAULT_ACCOUNT_ID) {
    return DEFAULT_CALLBACK_PATH;
  }
  return `${DEFAULT_CALLBACK_PATH}/${toPathSegment(accountId)}`;
}

function getChannelConfig(cfg: unknown): WecomChannelConfig | undefined {
  return (cfg as { channels?: { wecom?: WecomChannelConfig } } | null | undefined)?.channels?.wecom;
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

function parseAgentId(raw: string | number | undefined): string {
  if (raw === undefined || raw === null) {
    return "";
  }
  return String(raw).trim();
}

function parseAllowFrom(raw: string | string[] | undefined): string[] {
  if (!raw) {
    return [];
  }
  const list = Array.isArray(raw) ? raw : raw.split(",");
  return list.map((item) => item.trim()).filter(Boolean);
}

/** List all configured account IDs for this channel. */
export function listWecomAccountIds(cfg: unknown): string[] {
  const channelCfg = getChannelConfig(cfg);
  if (!channelCfg) {
    return [];
  }
  const ids = new Set<string>();
  const hasBaseConfig = channelCfg.corpId || channelCfg.token || channelCfg.encodingAesKey;
  if (hasBaseConfig) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }
  if (channelCfg.accounts) {
    for (const id of Object.keys(channelCfg.accounts)) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}

export function resolveWecomAccount(cfg: unknown, accountId?: string | null): ResolvedWecomAccount {
  const channelCfg = getChannelConfig(cfg) ?? {};
  const id = accountId || DEFAULT_ACCOUNT_ID;
  const override = channelCfg.accounts?.[id] ?? {};

  const corpId = firstNonEmpty(override.corpId, channelCfg.corpId, process.env.WECOM_CORP_ID);
  const secret = firstNonEmpty(override.secret, channelCfg.secret, process.env.WECOM_SECRET);
  const token = firstNonEmpty(override.token, channelCfg.token, process.env.WECOM_TOKEN);
  const encodingAesKey = firstNonEmpty(
    override.encodingAesKey,
    channelCfg.encodingAesKey,
    process.env.WECOM_ENCODING_AES_KEY,
  );
  const agentId = firstNonEmpty(
    parseAgentId(override.agentId),
    parseAgentId(channelCfg.agentId),
    process.env.WECOM_AGENT_ID ?? "",
  );

  return {
    accountId: id,
    enabled: override.enabled ?? channelCfg.enabled ?? true,
    corpId,
    agentId,
    secret,
    token,
    encodingAesKey,
    callbackPath: resolveWecomCallbackPath(id, override.callbackPath ?? channelCfg.callbackPath),
    dmPolicy: override.dmPolicy ?? channelCfg.dmPolicy ?? "allowlist",
    allowFrom: parseAllowFrom(override.allowFrom ?? channelCfg.allowFrom),
    outboundMsgType: override.outboundMsgType ?? channelCfg.outboundMsgType ?? "text",
    configured: Boolean(corpId && secret && agentId && token && encodingAesKey),
  };
}
