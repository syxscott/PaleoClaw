import type {
  ChannelAccountSnapshot,
  ChannelStatusIssue,
} from "paleoclaw/plugin-sdk/channel-contract";
import {
  resolveEnabledConfiguredAccountId,
  standardDmPolicyOpenIssue,
} from "paleoclaw/plugin-sdk/status-helpers";

export function collectZaloStatusIssues(accounts: ChannelAccountSnapshot[]): ChannelStatusIssue[] {
  const issues: ChannelStatusIssue[] = [];
  for (const account of accounts) {
    const accountId = resolveEnabledConfiguredAccountId(account);
    if (!accountId) {
      continue;
    }

    if (account.dmPolicy === "open") {
      issues.push(
        standardDmPolicyOpenIssue({
          channel: "zalo",
          accountId,
          channelLabel: "Zalo",
          configPath: "channels.zalo",
        }),
      );
    }
  }
  return issues;
}
