import { describe, expect, it, vi } from "vitest";
import { resolveWeixinAccount } from "./accounts.js";

describe("resolveWeixinAccount", () => {
  it("gives the default account the top-level token and bot id", () => {
    const account = resolveWeixinAccount(
      { channels: { weixin: { token: "top-token", botId: "top@im.bot" } } },
      "default",
    );
    expect(account.token).toBe("top-token");
    expect(account.botId).toBe("top@im.bot");
    expect(account.configured).toBe(true);
  });

  it("does not let a named account borrow the default account's credentials", () => {
    const account = resolveWeixinAccount(
      {
        channels: {
          weixin: {
            token: "top-token",
            botId: "top@im.bot",
            accounts: { personal: {} },
          },
        },
      },
      "personal",
    );
    expect(account.token).toBe("");
    expect(account.botId).toBe("");
    expect(account.configured).toBe(false);
  });

  it("does not let a named account borrow WEIXIN_TOKEN / WEIXIN_ACCOUNT_ID", () => {
    vi.stubEnv("WEIXIN_TOKEN", "env-token");
    vi.stubEnv("WEIXIN_ACCOUNT_ID", "env-bot@im.bot");
    const account = resolveWeixinAccount(
      { channels: { weixin: { accounts: { personal: {} } } } },
      "personal",
    );
    expect(account.token).toBe("");
    expect(account.botId).toBe("");
    expect(account.configured).toBe(false);
  });

  it("uses the named account's own credentials when they are configured", () => {
    const account = resolveWeixinAccount(
      {
        channels: {
          weixin: {
            token: "top-token",
            botId: "top@im.bot",
            accounts: { personal: { token: "own-token", botId: "own@im.bot" } },
          },
        },
      },
      "personal",
    );
    expect(account.token).toBe("own-token");
    expect(account.botId).toBe("own@im.bot");
    expect(account.configured).toBe(true);
  });
});
