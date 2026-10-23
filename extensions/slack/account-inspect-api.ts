import type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";
import { inspectSlackAccount } from "./src/account-inspect.js";

export function inspectSlackReadOnlyAccount(cfg: OpenClawConfig, accountId?: string | null) {
  return inspectSlackAccount({ cfg, accountId });
}
