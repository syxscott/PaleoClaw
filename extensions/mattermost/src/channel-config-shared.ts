import { describeAccountSnapshot } from "paleoclaw/plugin-sdk/account-helpers";
import { formatNormalizedAllowFromEntries } from "paleoclaw/plugin-sdk/allow-from";
import {
  adaptScopedAccountAccessor,
  createScopedChannelConfigAdapter,
} from "paleoclaw/plugin-sdk/channel-config-helpers";
import { normalizeLowercaseStringOrEmpty } from "paleoclaw/plugin-sdk/string-coerce-runtime";
import {
  inspectMattermostAccount,
  isMattermostConfigured,
  listMattermostAccountIds,
  resolveDefaultMattermostAccountId,
  resolveMattermostAccount,
  type ResolvedMattermostAccount,
} from "./mattermost/accounts.js";
export { resolveMattermostGatewayAuthBypassPaths } from "./gateway-auth-bypass.js";

export const mattermostMeta = {
  id: "mattermost",
  label: "Mattermost",
  selectionLabel: "Mattermost (plugin)",
  detailLabel: "Mattermost Bot",
  docsPath: "/channels/mattermost",
  docsLabel: "mattermost",
  blurb: "self-hosted Slack-style chat; install the plugin to enable.",
  systemImage: "bubble.left.and.bubble.right",
  order: 65,
  quickstartAllowFrom: true,
} as const;

export function normalizeMattermostAllowEntry(entry: string): string {
  return normalizeLowercaseStringOrEmpty(
    entry
      .trim()
      .replace(/^(mattermost|user):/i, "")
      .replace(/^@/, ""),
  );
}

function formatMattermostAllowEntry(entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("@")) {
    const username = trimmed.slice(1).trim();
    return username ? `@${normalizeLowercaseStringOrEmpty(username)}` : "";
  }
  return normalizeLowercaseStringOrEmpty(trimmed.replace(/^(mattermost|user):/i, ""));
}

export const mattermostConfigAdapter = createScopedChannelConfigAdapter<ResolvedMattermostAccount>({
  sectionKey: "mattermost",
  listAccountIds: listMattermostAccountIds,
  resolveAccount: adaptScopedAccountAccessor(resolveMattermostAccount),
  inspectAccount: adaptScopedAccountAccessor(inspectMattermostAccount),
  defaultAccountId: resolveDefaultMattermostAccountId,
  clearBaseFields: ["botToken", "baseUrl", "name"],
  resolveAllowFrom: (account) => account.config.allowFrom,
  formatAllowFrom: (allowFrom) =>
    formatNormalizedAllowFromEntries({
      allowFrom,
      normalizeEntry: formatMattermostAllowEntry,
    }),
});

export function describeMattermostAccount(account: ResolvedMattermostAccount) {
  return describeAccountSnapshot({
    account,
    configured: isMattermostConfigured(account),
    extra: {
      botTokenSource: account.botTokenSource,
      botTokenStatus: account.botTokenStatus,
      baseUrl: account.baseUrl,
    },
  });
}
