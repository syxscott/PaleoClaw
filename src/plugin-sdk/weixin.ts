// Narrow plugin-sdk surface for the bundled weixin plugin.
// Keep this list additive and scoped to symbols used under extensions/weixin.

export { resolveControlCommandGate } from "../channels/command-gating.js";
export { setAccountEnabledInConfigSection } from "../channels/plugins/config-helpers.js";
export { buildChannelConfigSchema } from "../channels/plugins/config-schema.js";
export type { ChannelId } from "../channels/plugins/types.public.js";
export { fetchWithSsrFGuard } from "../infra/net/fetch-guard.js";
export type { LookupFn, SsrFPolicy } from "../infra/net/ssrf.js";
export { issuePairingChallenge } from "../pairing/pairing-challenge.js";
export { emptyPluginConfigSchema } from "../plugins/config-schema.js";
export { registerPluginHttpRoute } from "../plugins/http-registry.js";
export type { PluginHttpRouteHandoff as PluginHttpRouteHandler } from "../plugins/http-registry.js";
export type { PluginRuntime } from "../plugins/runtime/types.js";
export type { OpenClawPluginApi } from "../plugins/types.js";
export { DEFAULT_ACCOUNT_ID } from "../routing/session-key.js";
export {
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithLists,
} from "../security/dm-policy-shared.js";
export type {
  DmGroupAccessDecision,
  DmGroupAccessReasonCode,
} from "../security/dm-policy-shared.js";
export { sliceUtf16Safe } from "../utils.js";
export type { ChannelPlugin } from "../channels/plugins/types.plugin.js";
export type { OpenClawConfig } from "../config/config.js";
export { createScopedPairingAccess } from "./pairing-access.js";
