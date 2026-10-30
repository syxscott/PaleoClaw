import { createLegacyPrivateNetworkDoctorContract } from "paleoclaw/plugin-sdk/runtime-doctor-migrations";

const contract = createLegacyPrivateNetworkDoctorContract({
  channelKey: "tlon",
});

export const legacyConfigRules = contract.legacyConfigRules;

export const normalizeCompatibilityConfig = contract.normalizeCompatibilityConfig;
