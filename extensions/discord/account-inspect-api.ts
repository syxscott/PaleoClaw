import type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";
import { inspectDiscordAccount } from "./src/account-inspect.js";

export function inspectDiscordReadOnlyAccount(cfg: OpenClawConfig, accountId?: string | null) {
  return inspectDiscordAccount({ cfg, accountId });
}
