/** Shared model-auth facade for runtime, Plugin SDK, and test import boundaries. */

export {
  ensureAuthProfileStore,
  ensureAuthProfileStoreAsync,
  ensureAuthProfileStoreWithoutExternalProfiles,
  ensureAuthProfileStoreWithoutExternalProfilesAsync,
  resolveAuthProfileOrder,
} from "./auth-profiles.js";
export { resolveAuthProfileOrderWithMetadata } from "./auth-profiles/order.js";
export { resolveEnvApiKey } from "./model-auth-env.js";
export {
  applyAuthHeaderOverride,
  applyLocalNoAuthHeaderOverride,
  applySecretRefHeaderSentinels,
  getApiKeyForModelCore,
  hasAvailableAuthForProvider,
  resolveModelAuthMode,
  resolveModelAuthModeAsync,
} from "./model-auth-model.js";
export type { ModelAuthMode } from "./model-auth-model.js";
export {
  getCustomProviderApiKey,
  hasSyntheticLocalProviderAuthConfig,
  hasUsableCustomProviderApiKey,
  isConfigBackedInlineProviderApiKey,
  resolveProviderEntryApiKeyBinding,
  resolveProviderEntryApiKeyProfileReference,
  resolveUsableCustomProviderApiKey,
  shouldPreferExplicitConfigApiKeyAuth,
} from "./model-auth-provider-config.js";
export { resolveApiKeyForProviderCore } from "./model-auth-provider.js";
export {
  createRuntimeProviderAuthLookup,
  hasRuntimeAvailableProviderAuth,
  prepareRuntimeAvailableProviderAuth,
} from "./model-auth-runtime.js";
export type { RuntimeProviderAuthLookup } from "./model-auth-runtime.js";
export {
  formatMissingAuthError,
  isMissingProviderAuthError,
  isProviderAuthError,
  MissingProviderAuthError,
  ProviderAuthError,
  requireApiKey,
} from "./model-auth-runtime-shared.js";
export type { ResolvedProviderAuth } from "./model-auth-runtime-shared.js";

// --- PaleoClaw 兼容层：getApiKeyForModel（pc 3 月 API，上游 10 月已改名）---
export async function getApiKeyForModel(params: {
  model: Model<Api>;
  cfg?: OpenClawConfig;
  profileId?: string;
  preferredProfile?: string;
  store?: AuthProfileStore;
  agentDir?: string;
}): Promise<ResolvedProviderAuth> {
  return resolveApiKeyForProvider({
    provider: params.model.provider,
    cfg: params.cfg,
    profileId: params.profileId,
    preferredProfile: params.preferredProfile,
    store: params.store,
    agentDir: params.agentDir,
  });
}
