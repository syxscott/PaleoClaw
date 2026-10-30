import type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";
import { resolveAgentRoute } from "paleoclaw/plugin-sdk/routing";

export function resolveTelegramAccountOwnerAgentId(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): string {
  const { cfg, accountId } = params;
  return resolveAgentRoute({ cfg, channel: "telegram", accountId }).agentId;
}
