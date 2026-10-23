// Legacy per-channel message action listing for the pre-upstream embedded runner.
//
// Upstream removed the channel plugin `actions.listActions` contract, so the
// legacy runner can no longer enumerate per-channel message actions. The prompt
// path that actually matters (resolveChannelMessageToolHints) is served by the
// current channel-tools module, so the legacy listing degrades to an empty list.
import type { ChannelMessageActionName } from "../channels/plugins/types.public.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";

export function listChannelSupportedActions(_params: {
  cfg?: OpenClawConfig;
  channel?: string;
}): ChannelMessageActionName[] {
  return [];
}
