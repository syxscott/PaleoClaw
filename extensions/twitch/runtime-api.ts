// Private runtime barrel for the bundled Twitch extension.
// Keep this barrel thin and aligned with the local extension surface.

export type {
  ChannelAccountSnapshot,
  ChannelCapabilities,
  ChannelGatewayContext,
  ChannelLogSink,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelOutboundContext,
  ChannelResolveKind,
  ChannelResolveResult,
  ChannelStatusAdapter,
} from "paleoclaw/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "paleoclaw/plugin-sdk/channel-core";
export type { OutboundDeliveryResult } from "paleoclaw/plugin-sdk/channel-send-result";
export type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";
export type { RuntimeEnv } from "paleoclaw/plugin-sdk/runtime";
export type { WizardPrompter } from "paleoclaw/plugin-sdk/setup";
