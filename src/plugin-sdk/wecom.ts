// Narrow plugin-sdk surface for the bundled wecom plugin.
// Keep this list additive and scoped to symbols used under extensions/wecom.

export { resolveControlCommandGate } from "../channels/command-gating.js";
export { logInboundDrop } from "../channels/logging.js";
export { setAccountEnabledInConfigSection } from "../channels/plugins/config-helpers.js";
export { buildChannelConfigSchema } from "../channels/plugins/config-schema.js";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "../infra/http-body.js";
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
export type { ChannelPlugin } from "../channels/plugins/types.plugin.js";
export type { OpenClawConfig } from "../config/config.js";
export { createScopedPairingAccess } from "./pairing-access.js";
