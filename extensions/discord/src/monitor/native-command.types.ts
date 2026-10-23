import type {
  BuildChannelInboundEventContextParams,
  BuiltChannelInboundEventContext,
  ChannelInboundTurnPlan,
} from "paleoclaw/plugin-sdk/channel-inbound";
import type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";

export type DiscordConfig = NonNullable<OpenClawConfig["channels"]>["discord"];
export type DiscordDispatchReplyFromConfig = NonNullable<
  ChannelInboundTurnPlan["dispatchReplyFromConfig"]
>;

export type DiscordBuildInboundContext = (
  params: BuildChannelInboundEventContextParams,
) => BuiltChannelInboundEventContext | Promise<BuiltChannelInboundEventContext>;
