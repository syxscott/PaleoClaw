import type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";

type SignalChannelConfig = Exclude<NonNullable<OpenClawConfig["channels"]>["signal"], undefined>;

export type SignalAccountConfig = Omit<SignalChannelConfig, "accounts" | "defaultAccount">;

export type SignalTransportConfig = NonNullable<SignalChannelConfig["transport"]>;
