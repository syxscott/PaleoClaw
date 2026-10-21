import {
  resolveChannelPreviewStreamMode,
  type StreamingMode,
} from "paleoclaw/plugin-sdk/channel-outbound";

export function resolveDiscordPreviewStreamMode(
  params: {
    streaming?: unknown;
  } = {},
): StreamingMode {
  return resolveChannelPreviewStreamMode(params, "progress");
}
