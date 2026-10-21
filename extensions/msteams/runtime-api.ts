// Private runtime barrel for the bundled Microsoft Teams extension.
// Keep this barrel thin and aligned with the local extension surface.

export { DEFAULT_ACCOUNT_ID } from "paleoclaw/plugin-sdk/account-id";
export { mergeAllowlist, summarizeMapping } from "paleoclaw/plugin-sdk/allow-from";
export type {
  BaseProbeResult,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelOutboundAdapter,
} from "paleoclaw/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "paleoclaw/plugin-sdk/channel-core";
export { logTypingFailure } from "paleoclaw/plugin-sdk/channel-outbound";
export { createChannelPairingController } from "paleoclaw/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "paleoclaw/plugin-sdk/channel-outbound";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "paleoclaw/plugin-sdk/channel-status";
export {
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveChannelEntryMatchWithFallback,
  resolveNestedAllowlistDecision,
} from "paleoclaw/plugin-sdk/channel-targets";
export type {
  GroupToolPolicyConfig,
  MSTeamsChannelConfig,
  MSTeamsCloudName,
  MSTeamsConfig,
  MSTeamsReplyStyle,
  MSTeamsTeamConfig,
  MarkdownTableMode,
  OpenClawConfig,
} from "paleoclaw/plugin-sdk/config-contracts";
export { isDangerousNameMatchingEnabled } from "paleoclaw/plugin-sdk/dangerous-name-runtime";
export { resolveDefaultGroupPolicy } from "paleoclaw/plugin-sdk/runtime-group-policy";
export {
  detectMime,
  extensionForMime,
  extractOriginalFilename,
  getFileExtension,
} from "paleoclaw/plugin-sdk/media-runtime";
export { resolveChannelMediaMaxBytes } from "paleoclaw/plugin-sdk/account-helpers";
export { loadOutboundMediaFromUrl } from "paleoclaw/plugin-sdk/outbound-media";
// Deprecated media-legacy-projection surface; the re-export stays until the
// compat record's removeAfter window expires (deleted in retirement PR 4).
export { buildMediaPayload } from "paleoclaw/plugin-sdk/reply-payload";
export type { ReplyPayload } from "paleoclaw/plugin-sdk/reply-payload";
export type { PluginRuntime } from "paleoclaw/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "paleoclaw/plugin-sdk/runtime";
export type { SsrFPolicy } from "paleoclaw/plugin-sdk/ssrf-runtime";
export { fetchWithSsrFGuard } from "paleoclaw/plugin-sdk/ssrf-runtime";
export { normalizeStringEntries } from "paleoclaw/plugin-sdk/string-normalization-runtime";
export { chunkTextForOutbound } from "paleoclaw/plugin-sdk/text-chunking";
export { DEFAULT_WEBHOOK_MAX_BODY_BYTES } from "paleoclaw/plugin-sdk/webhook-ingress";
export { setMSTeamsRuntime } from "./src/runtime.js";
