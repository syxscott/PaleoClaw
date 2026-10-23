import { describe, expect, it } from "vitest";
import { qqbotPlugin } from "./channel.js";
import type { CoreConfig } from "./types.js";

function config(): CoreConfig {
  return {
    channels: {
      qqbot: {
        appId: "app-1",
        appSecret: "secret-1",
        allowFrom: ["default-user"],
        defaultTo: "default-target",
        accounts: {
          work: {
            appId: "app-2",
            appSecret: "secret-2",
            allowFrom: ["work-user"],
            defaultTo: "work-target",
          },
        },
      },
    },
  } as unknown as CoreConfig;
}

describe("qqbot channel config adapter", () => {
  it("resolves the allowlist of the requested account", () => {
    expect(qqbotPlugin.config.resolveAllowFrom?.({ cfg: config(), accountId: "work" })).toEqual([
      "work-user",
    ]);
    expect(qqbotPlugin.config.resolveAllowFrom?.({ cfg: config() })).toEqual(["default-user"]);
  });

  it("resolves the default target of the requested account", () => {
    expect(qqbotPlugin.config.resolveDefaultTo?.({ cfg: config(), accountId: "work" })).toBe(
      "work-target",
    );
    expect(qqbotPlugin.config.resolveDefaultTo?.({ cfg: config() })).toBe("default-target");
  });

  it("advertises the pairing approve command with the pairing code placeholder", () => {
    const approveHint = qqbotPlugin.security?.resolveDmPolicy?.({
      cfg: config(),
      accountId: "default",
      account: qqbotPlugin.config.resolveAccount(config(), "default"),
    } as never);
    expect(approveHint?.approveHint).toContain("paleoclaw pairing approve qqbot");
    expect(approveHint?.approveHint).toContain("<code>");
    expect(approveHint?.approveHint).not.toContain("<openid>");
  });

  it("does not promise guild media support in the agent hints", () => {
    const hints = qqbotPlugin.agentPrompt?.messageToolHints?.({ cfg: config() }) ?? [];
    const mediaHint = hints.find((hint) => hint.includes("Media")) ?? "";
    expect(mediaHint).toContain("c2c/group targets only");
  });
});
