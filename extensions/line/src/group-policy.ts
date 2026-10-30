import {
  buildChannelGroupsScopeTree,
  resolveScopeRequireMention,
} from "paleoclaw/plugin-sdk/channel-policy";
import type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";
import { resolveExactLineGroupConfigKey } from "./group-keys.js";

type LineGroupContext = { cfg: OpenClawConfig; accountId?: string | null; groupId?: string | null };

export function resolveLineGroupRequireMention(params: LineGroupContext): boolean {
  const tree = buildChannelGroupsScopeTree(params.cfg, "line", params.accountId);
  const matchedKey = resolveExactLineGroupConfigKey({
    groups: tree.scopes,
    groupId: params.groupId,
  });
  return resolveScopeRequireMention({
    tree,
    path: matchedKey ? [matchedKey] : [],
  });
}
