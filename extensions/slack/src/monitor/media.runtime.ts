import { createSubsystemLogger } from "paleoclaw/plugin-sdk/runtime-env";

export const slackMediaLog = createSubsystemLogger("gateway/channels/slack").child("media");
export { fetchWithRuntimeDispatcher } from "paleoclaw/plugin-sdk/runtime-fetch";
export type { FetchLike } from "paleoclaw/plugin-sdk/media-runtime";
export { captureChannelReadAuthority } from "paleoclaw/plugin-sdk/fetch-runtime";
export { saveRemoteMedia, unlinkIfExists } from "paleoclaw/plugin-sdk/media-runtime";
