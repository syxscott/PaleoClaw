// Private runtime barrel for the bundled Nextcloud Talk extension.
// Keep this barrel thin and aligned with the local extension surface.

export type { AllowlistMatch } from "paleoclaw/plugin-sdk/allow-from";
export type { ChannelGroupContext } from "paleoclaw/plugin-sdk/channel-contract";
export { logInboundDrop } from "paleoclaw/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "paleoclaw/plugin-sdk/channel-pairing";
export type {
  GroupPolicy,
  GroupToolPolicyConfig,
  OpenClawConfig,
} from "paleoclaw/plugin-sdk/config-contracts";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "paleoclaw/plugin-sdk/runtime-group-policy";
export type { OutboundReplyPayload } from "paleoclaw/plugin-sdk/reply-payload";
export type { PluginRuntime } from "paleoclaw/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "paleoclaw/plugin-sdk/runtime";
export { fetchWithSsrFGuard } from "paleoclaw/plugin-sdk/ssrf-runtime";
export { setNextcloudTalkRuntime } from "./src/runtime.js";
