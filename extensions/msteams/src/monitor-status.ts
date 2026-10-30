import type { ChannelAccountSnapshot } from "paleoclaw/plugin-sdk/channel-contract";
import {
  channelBlockedPatch,
  channelReadyPatch,
  channelStoppedPatch,
} from "paleoclaw/plugin-sdk/gateway-runtime";

export type MSTeamsStatusSink = (patch: Omit<ChannelAccountSnapshot, "accountId">) => void;

export function publishMSTeamsBlocked(
  statusSink: MSTeamsStatusSink | undefined,
  lastError: string,
) {
  statusSink?.(channelBlockedPatch(lastError, { running: true }));
}

export function publishMSTeamsReady(statusSink: MSTeamsStatusSink | undefined, now = Date.now()) {
  statusSink?.(channelReadyPatch({ lastConnectedAt: now }));
}

export function publishMSTeamsStopped(statusSink: MSTeamsStatusSink | undefined) {
  statusSink?.(channelStoppedPatch());
}
