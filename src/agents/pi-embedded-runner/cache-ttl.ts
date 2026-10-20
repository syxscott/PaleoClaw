import { supportsProviderCacheTtl } from "../provider-capabilities.js";

type CustomEntryLike = { type?: unknown; customType?: unknown; data?: unknown };

export const CACHE_TTL_CUSTOM_TYPE = "paleoclaw.cache-ttl";

export type CacheTtlEntryData = {
  timestamp: number;
  provider?: string;
  modelId?: string;
};

/**
 * Whether long-lived prompt caches (TTL) are available for a provider/model.
 *
 * The answer is owned by the declarative provider capability table
 * (`src/agents/provider-capabilities.ts`): a provider opts in explicitly and
 * may restrict the opt-in to model-id prefixes. Operators can extend it for
 * custom providers through `<agentDir>/provider-capabilities.json` without a
 * code change.
 */
export function isCacheTtlEligibleProvider(provider: string, modelId: string): boolean {
  return supportsProviderCacheTtl({ provider, modelId });
}

export function readLastCacheTtlTimestamp(sessionManager: unknown): number | null {
  const sm = sessionManager as { getEntries?: () => CustomEntryLike[] };
  if (!sm?.getEntries) {
    return null;
  }
  try {
    const entries = sm.getEntries();
    let last: number | null = null;
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry?.type !== "custom" || entry?.customType !== CACHE_TTL_CUSTOM_TYPE) {
        continue;
      }
      const data = entry?.data as Partial<CacheTtlEntryData> | undefined;
      const ts = typeof data?.timestamp === "number" ? data.timestamp : null;
      if (ts && Number.isFinite(ts)) {
        last = ts;
        break;
      }
    }
    return last;
  } catch {
    return null;
  }
}

export function appendCacheTtlTimestamp(sessionManager: unknown, data: CacheTtlEntryData): void {
  const sm = sessionManager as {
    appendCustomEntry?: (customType: string, data: unknown) => void;
  };
  if (!sm?.appendCustomEntry) {
    return;
  }
  try {
    sm.appendCustomEntry(CACHE_TTL_CUSTOM_TYPE, data);
  } catch {
    // ignore persistence failures
  }
}
