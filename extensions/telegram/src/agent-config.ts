import { resolveAgentConfig } from "paleoclaw/plugin-sdk/agent-scope-runtime";
import type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";

export function resolveTelegramConfigReasoningDefault(cfg: OpenClawConfig, agentId: string) {
  const agentDefault = resolveAgentConfig(cfg, agentId)?.reasoningDefault;
  return agentDefault ?? cfg.agents?.defaults?.reasoningDefault ?? "off";
}
