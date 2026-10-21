export {
  createAccountListHelpers,
  hasConfiguredAccountValue,
  listCombinedAccountIds,
  normalizeAccountId,
  normalizeE164,
  normalizeOptionalAccountId,
  resolveListedDefaultAccountId,
  resolveMergedAccountConfig,
  resolveNormalizedAccountEntry,
  resolveUserPath,
  DEFAULT_ACCOUNT_ID,
} from "./account-core.js";

export type { OpenClawConfig } from "../config/types.openclaw.js";
export { resolveAccountEntry, resolveAccountKey } from "../routing/account-lookup.js";
export type { ChannelAccountKeyPolicy } from "../routing/account-lookup.js";

// --- PaleoClaw 兼容层：listConfiguredAccountIds（pc 3 月 API，上游 10 月已改名）---
export function listConfiguredAccountIds(params: {
  accounts: Record<string, unknown> | undefined;
  normalizeAccountId: (accountId: string) => string;
}): string[] {
  if (!params.accounts) {
    return [];
  }
  const ids = new Set<string>();
  for (const key of Object.keys(params.accounts)) {
    if (!key) {
      continue;
    }
    ids.add(params.normalizeAccountId(key));
  }
  return [...ids];
}

// --- PaleoClaw 兼容层：resolveAccountWithDefaultFallback（pc 3 月 API，上游 10 月已改名）---
export function resolveAccountWithDefaultFallback<TAccount>(params: {
  accountId?: string | null;
  normalizeAccountId: (accountId?: string | null) => string;
  resolvePrimary: (accountId: string) => TAccount;
  hasCredential: (account: TAccount) => boolean;
  resolveDefaultAccountId: () => string;
}): TAccount {
  const hasExplicitAccountId = Boolean(params.accountId?.trim());
  const normalizedAccountId = params.normalizeAccountId(params.accountId);
  const primary = params.resolvePrimary(normalizedAccountId);
  if (hasExplicitAccountId || params.hasCredential(primary)) {
    return primary;
  }

  const fallbackId = params.resolveDefaultAccountId();
  if (fallbackId === normalizedAccountId) {
    return primary;
  }
  const fallback = params.resolvePrimary(fallbackId);
  if (!params.hasCredential(fallback)) {
    return primary;
  }
  return fallback;
}
