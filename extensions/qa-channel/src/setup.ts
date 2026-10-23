import type { ChannelSetupInput } from "paleoclaw/plugin-sdk/channel-setup";
import type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";
import { patchScopedAccountConfig } from "paleoclaw/plugin-sdk/setup";

export type QaChannelSetupInput = ChannelSetupInput & {
  baseUrl?: string;
  botUserId?: string;
  botDisplayName?: string;
};

export function applyQaSetup(params: {
  cfg: OpenClawConfig;
  accountId: string;
  input: QaChannelSetupInput;
}): OpenClawConfig {
  const patch: Record<string, unknown> = {};
  for (const key of ["baseUrl", "botUserId", "botDisplayName"] as const) {
    if (typeof params.input[key] === "string") {
      patch[key] = params.input[key];
    }
  }
  return patchScopedAccountConfig({
    cfg: params.cfg,
    channelKey: "qa-channel",
    accountId: params.accountId,
    patch,
    ensureChannelEnabled: false,
    ensureAccountEnabled: false,
  });
}
