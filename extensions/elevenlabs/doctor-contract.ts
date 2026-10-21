import type { ChannelDoctorLegacyConfigRule } from "paleoclaw/plugin-sdk/channel-contract";
import type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";
import {
  ELEVENLABS_TALK_PROVIDER_ID,
  hasLegacyTalkFields,
  migrateElevenLabsLegacyTalkConfig,
} from "./config-compat.js";

export { hasLegacyTalkFields } from "./config-compat.js";

export const legacyConfigRules: ChannelDoctorLegacyConfigRule[] = [
  {
    path: ["talk"],
    message:
      "talk.voiceId/talk.voiceAliases/talk.modelId/talk.outputFormat/talk.apiKey are legacy; use talk.providers.<provider> and run paleoclaw doctor --fix.",
    match: hasLegacyTalkFields,
  },
];

export const ELEVENLABS_TALK_LEGACY_CONFIG_RULES = legacyConfigRules;

export function normalizeCompatibilityConfig({ cfg }: { cfg: OpenClawConfig }): {
  config: OpenClawConfig;
  changes: string[];
} {
  return migrateElevenLabsLegacyTalkConfig(cfg);
}

export { ELEVENLABS_TALK_PROVIDER_ID };
