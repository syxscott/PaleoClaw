import {
  DEFAULT_ACCOUNT_ID,
  readStoreAllowFromForDmPolicy,
  resolveEffectiveAllowFromLists,
} from "paleoclaw/plugin-sdk/qqbot";
import { QQBOT_DEFAULT_INTENTS } from "./constants.js";
import type {
  CoreConfig,
  QqbotAccountConfig,
  QqbotAccessPolicy,
  ResolvedQqbotAccount,
} from "./types.js";

const TRUTHY_ENV = new Set(["true", "1", "yes", "on"]);

export const DEFAULT_QQBOT_ACCOUNT_ID = DEFAULT_ACCOUNT_ID;

function normalizeEntryList(value: Array<string | number> | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function coerceList(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return normalizeEntryList(value as Array<string | number> | undefined);
}

function resolvePolicy(value: string | undefined, fallback: QqbotAccessPolicy): QqbotAccessPolicy {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === "open" ||
    normalized === "allowlist" ||
    normalized === "pairing" ||
    normalized === "disabled"
  ) {
    return normalized;
  }
  return fallback;
}

function resolveAccountConfig(cfg: CoreConfig, accountId: string): QqbotAccountConfig {
  const section = cfg.channels?.qqbot ?? {};
  const { accounts: _accounts, defaultAccount: _defaultAccount, ...base } = section;
  const account = section.accounts?.[accountId] ?? {};
  return { ...base, ...account };
}

export function listQqbotAccountIds(cfg: CoreConfig): string[] {
  const accounts = cfg.channels?.qqbot?.accounts;
  const extra = accounts ? Object.keys(accounts) : [];
  return [DEFAULT_QQBOT_ACCOUNT_ID, ...extra.filter((id) => id !== DEFAULT_QQBOT_ACCOUNT_ID)];
}

export function resolveDefaultQqbotAccountId(cfg: CoreConfig): string {
  const configured = cfg.channels?.qqbot?.defaultAccount?.trim();
  if (configured && listQqbotAccountIds(cfg).includes(configured)) {
    return configured;
  }
  const configuredAccounts = listQqbotAccountIds(cfg).filter(
    (id) => id !== DEFAULT_QQBOT_ACCOUNT_ID,
  );
  if (resolveQqbotAccount({ cfg, accountId: DEFAULT_QQBOT_ACCOUNT_ID }).configured) {
    return DEFAULT_QQBOT_ACCOUNT_ID;
  }
  return configuredAccounts[0] ?? DEFAULT_QQBOT_ACCOUNT_ID;
}

/**
 * Resolve the effective account config: channels.qqbot base merged with
 * channels.qqbot.accounts[<id>], with QQ_APP_ID / QQ_APP_SECRET / QQ_CLIENT_SECRET
 * env fallbacks on the default account (mirrors the reference adapter).
 */
export function resolveQqbotAccount(params: {
  cfg: CoreConfig;
  accountId?: string | null;
}): ResolvedQqbotAccount {
  const accountId = params.accountId?.trim() || DEFAULT_QQBOT_ACCOUNT_ID;
  const merged = resolveAccountConfig(params.cfg, accountId);
  const enabled = params.cfg.channels?.qqbot?.enabled !== false && merged.enabled !== false;

  const envAppId =
    accountId === DEFAULT_QQBOT_ACCOUNT_ID ? process.env.QQ_APP_ID?.trim() : undefined;
  const appId = merged.appId?.trim() || envAppId || "";

  let clientSecret = merged.appSecret?.trim() || merged.clientSecret?.trim() || "";
  let secretSource: ResolvedQqbotAccount["secretSource"] = merged.appSecret?.trim()
    ? "config:appSecret"
    : merged.clientSecret?.trim()
      ? "config:clientSecret"
      : "none";
  if (!clientSecret && accountId === DEFAULT_QQBOT_ACCOUNT_ID) {
    const envSecret =
      process.env.QQ_APP_SECRET?.trim() || process.env.QQ_CLIENT_SECRET?.trim() || "";
    if (envSecret) {
      clientSecret = envSecret;
      secretSource = process.env.QQ_APP_SECRET?.trim()
        ? "env:QQ_APP_SECRET"
        : "env:QQ_CLIENT_SECRET";
    }
  }

  const dmPolicy = resolvePolicy(merged.dmPolicy, "pairing");
  const groupPolicy = resolvePolicy(merged.groupPolicy, "allowlist");

  return {
    accountId,
    enabled,
    name: merged.name?.trim() || undefined,
    configured: Boolean(appId && clientSecret),
    appId,
    clientSecret,
    secretSource,
    mode: "websocket",
    sandbox: merged.sandbox === true,
    markdown: merged.markdown !== false,
    intents: typeof merged.intents === "number" ? merged.intents : QQBOT_DEFAULT_INTENTS,
    dmPolicy,
    allowFrom: coerceList(merged.allowFrom),
    groupPolicy,
    groupAllowFrom: coerceList(merged.groupAllowFrom),
    defaultTo: merged.defaultTo?.trim() || undefined,
  };
}

/** Masked AppID for status/probe output (the full id is never exposed). */
export function maskQqbotAppId(appId: string): string {
  return appId ? `${appId.slice(0, 4)}***` : "";
}

/** ACL check mirroring the reference _entry_matches ("*" wildcards allowed). */
export function allowListMatches(allowFrom: string[], target: string): boolean {
  const normalized = target.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return allowFrom.some((entry) => {
    const candidate = entry.trim().toLowerCase();
    return candidate === "*" || candidate === normalized;
  });
}

/**
 * Effective allowlists for one account: the configured lists merged with the
 * pairing store (DM only, and only for policies that read the store).
 */
export function resolveQqbotEffectiveAllowFrom(
  account: ResolvedQqbotAccount,
  storeAllowFrom: string[] = [],
): { effectiveAllowFrom: string[]; effectiveGroupAllowFrom: string[] } {
  return resolveEffectiveAllowFromLists({
    allowFrom: account.allowFrom,
    groupAllowFrom: account.groupAllowFrom,
    storeAllowFrom,
    dmPolicy: account.dmPolicy,
    // QQ requires an explicit groupAllowFrom; never fall back to the DM allowlist.
    groupAllowFromFallbackToAllowFrom: false,
  });
}

/**
 * Read the pairing store for this account. The store is only consulted for the
 * pairing policy (the "allowlist" policy is config-only, matching the SDK).
 */
export async function readQqbotStoreAllowFrom(params: {
  account: ResolvedQqbotAccount;
  readStore: (provider: string, accountId: string) => Promise<string[]>;
}): Promise<string[]> {
  return await readStoreAllowFromForDmPolicy({
    provider: "qqbot",
    accountId: params.account.accountId,
    dmPolicy: params.account.dmPolicy,
    shouldRead: params.account.dmPolicy === "pairing",
    readStore: params.readStore,
  });
}

export function isDmIntakeAllowed(
  account: ResolvedQqbotAccount,
  senderId: string,
  options?: { storeAllowFrom?: string[] },
): boolean {
  const principal = senderId.trim();
  if (!principal) {
    return false;
  }
  if (account.dmPolicy === "open") {
    return true;
  }
  if (account.dmPolicy === "disabled") {
    return false;
  }
  // "allowlist" and "pairing" both gate on the effective allowlist; pairing
  // additionally accepts senders that were approved through the pairing store.
  const { effectiveAllowFrom } = resolveQqbotEffectiveAllowFrom(
    account,
    options?.storeAllowFrom ?? [],
  );
  return allowListMatches(effectiveAllowFrom, principal);
}

export function isGroupAllowed(
  account: ResolvedQqbotAccount,
  groupId: string,
  options?: { storeAllowFrom?: string[] },
): boolean {
  if (account.groupPolicy === "open") {
    return true;
  }
  if (account.groupPolicy === "disabled") {
    return false;
  }
  // Group access is always allowlist-based (the pairing store is DM-only).
  const { effectiveGroupAllowFrom } = resolveQqbotEffectiveAllowFrom(
    account,
    options?.storeAllowFrom ?? [],
  );
  return allowListMatches(effectiveGroupAllowFrom, groupId);
}
