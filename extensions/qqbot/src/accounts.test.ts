import { afterEach, describe, expect, it } from "vitest";
import {
  allowListMatches,
  isDmIntakeAllowed,
  isGroupAllowed,
  listQqbotAccountIds,
  resolveQqbotAccount,
} from "./accounts.js";
import { InboundDeduper } from "./monitor.js";
import type { CoreConfig, ResolvedQqbotAccount } from "./types.js";

function baseAccount(overrides?: Partial<ResolvedQqbotAccount>): ResolvedQqbotAccount {
  return {
    accountId: "default",
    enabled: true,
    configured: true,
    appId: "app-1",
    clientSecret: "sec-1",
    secretSource: "config:appSecret",
    mode: "websocket",
    sandbox: false,
    markdown: true,
    intents: 0,
    dmPolicy: "allowlist",
    allowFrom: [],
    groupPolicy: "allowlist",
    groupAllowFrom: [],
    ...overrides,
  };
}

function configWith(section: Record<string, unknown>): CoreConfig {
  return { channels: { qqbot: section } } as unknown as CoreConfig;
}

const ENV_KEYS = ["QQ_APP_ID", "QQ_APP_SECRET", "QQ_CLIENT_SECRET"] as const;

function withEnv(values: Record<string, string | undefined>): () => void {
  const saved = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) {
    saved.set(key, process.env[key]);
    if (key in values) {
      process.env[key] = values[key];
    } else {
      delete process.env[key];
    }
  }
  return () => {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

afterEach(() => {
  withEnv({})();
});

describe("resolveQqbotAccount", () => {
  it("merges base section with account overrides", () => {
    const cfg = configWith({
      appId: "base-app",
      appSecret: "base-secret",
      sandbox: true,
      accounts: {
        second: { appId: "second-app", appSecret: "second-secret", sandbox: false },
      },
    });

    const base = resolveQqbotAccount({ cfg });
    expect(base.appId).toBe("base-app");
    expect(base.sandbox).toBe(true);

    const second = resolveQqbotAccount({ cfg, accountId: "second" });
    expect(second.appId).toBe("second-app");
    expect(second.sandbox).toBe(false);
    expect(second.configured).toBe(true);
  });

  it("prefers appSecret over clientSecret and reports the source", () => {
    const cfg = configWith({ appId: "a", appSecret: "s1", clientSecret: "s2" });
    const account = resolveQqbotAccount({ cfg });
    expect(account.clientSecret).toBe("s1");
    expect(account.secretSource).toBe("config:appSecret");
  });

  it("falls back to QQ_APP_ID / QQ_APP_SECRET env on the default account", () => {
    const restore = withEnv({ QQ_APP_ID: "env-app", QQ_APP_SECRET: "env-secret" });
    try {
      const account = resolveQqbotAccount({ cfg: configWith({}) });
      expect(account.appId).toBe("env-app");
      expect(account.clientSecret).toBe("env-secret");
      expect(account.secretSource).toBe("env:QQ_APP_SECRET");
      expect(account.configured).toBe(true);
    } finally {
      restore();
    }
  });

  it("prefers QQ_APP_SECRET over QQ_CLIENT_SECRET", () => {
    const restore = withEnv({
      QQ_APP_ID: "env-app",
      QQ_APP_SECRET: "s-app",
      QQ_CLIENT_SECRET: "s-client",
    });
    try {
      const account = resolveQqbotAccount({ cfg: configWith({}) });
      expect(account.clientSecret).toBe("s-app");
      expect(account.secretSource).toBe("env:QQ_APP_SECRET");
    } finally {
      restore();
    }
  });

  it("does not apply env credentials to non-default accounts", () => {
    const restore = withEnv({ QQ_APP_ID: "env-app", QQ_APP_SECRET: "env-secret" });
    try {
      const cfg = configWith({ accounts: { alt: {} } });
      const alt = resolveQqbotAccount({ cfg, accountId: "alt" });
      expect(alt.appId).toBe("");
      expect(alt.configured).toBe(false);
    } finally {
      restore();
    }
  });

  it("lists account ids (default first) and honors enabled=false", () => {
    const cfg = configWith({
      accounts: { alt: { enabled: true }, default: undefined },
    });
    expect(listQqbotAccountIds(cfg)).toEqual(["default", "alt"]);

    // Section-level enabled=false disables every account in the section.
    const disabledCfg = configWith({ enabled: false, accounts: { alt: { enabled: true } } });
    expect(resolveQqbotAccount({ cfg: disabledCfg }).enabled).toBe(false);
    expect(resolveQqbotAccount({ cfg: disabledCfg, accountId: "alt" }).enabled).toBe(false);

    // Account-level enabled=false disables only that account.
    const altDisabledCfg = configWith({ accounts: { alt: { enabled: false } } });
    expect(resolveQqbotAccount({ cfg: altDisabledCfg, accountId: "alt" }).enabled).toBe(false);
    expect(resolveQqbotAccount({ cfg: altDisabledCfg }).enabled).toBe(true);
  });
});

describe("allowlist policies", () => {
  it("allowListMatches is case-insensitive and supports *", () => {
    expect(allowListMatches(["ABC"], "abc")).toBe(true);
    expect(allowListMatches(["*"], "anything")).toBe(true);
    expect(allowListMatches(["abc"], "xyz")).toBe(false);
    expect(allowListMatches([], "")).toBe(false);
  });

  it("dm intake: open allows, allowlist gates, pairing behaves as allowlist, disabled blocks", () => {
    const open = baseAccount({ dmPolicy: "open" });
    expect(isDmIntakeAllowed(open, "anyone")).toBe(true);

    const allowlist = baseAccount({ dmPolicy: "allowlist", allowFrom: ["user-1"] });
    expect(isDmIntakeAllowed(allowlist, "user-1")).toBe(true);
    expect(isDmIntakeAllowed(allowlist, "user-2")).toBe(false);

    const pairing = baseAccount({ dmPolicy: "pairing", allowFrom: ["user-1"] });
    expect(isDmIntakeAllowed(pairing, "user-1")).toBe(true);
    expect(isDmIntakeAllowed(pairing, "user-2")).toBe(false);

    const disabled = baseAccount({ dmPolicy: "disabled" });
    expect(isDmIntakeAllowed(disabled, "user-1")).toBe(false);

    expect(isDmIntakeAllowed(open, "  ")).toBe(false);
  });

  it("group access follows groupPolicy + groupAllowFrom", () => {
    const allowlist = baseAccount({ groupPolicy: "allowlist", groupAllowFrom: ["grp-1"] });
    expect(isGroupAllowed(allowlist, "grp-1")).toBe(true);
    expect(isGroupAllowed(allowlist, "grp-2")).toBe(false);

    const open = baseAccount({ groupPolicy: "open" });
    expect(isGroupAllowed(open, "anything")).toBe(true);
  });
});

describe("InboundDeduper", () => {
  it("flags repeats within the window", () => {
    const deduper = new InboundDeduper();
    const t0 = 1_000_000;
    expect(deduper.isDuplicate("m1", t0)).toBe(false);
    expect(deduper.isDuplicate("m1", t0 + 1000)).toBe(true);
    expect(deduper.isDuplicate("m2", t0 + 1000)).toBe(false);
  });

  it("evicts aged entries once the size cap is exceeded (reference behavior)", () => {
    const deduper = new InboundDeduper();
    const t0 = 1_000_000;
    expect(deduper.isDuplicate("m1", t0)).toBe(false);

    // Fill beyond DEDUP_MAX_SIZE so the eviction pass activates.
    const now = t0 + 1000;
    for (let i = 0; i < 1200; i += 1) {
      deduper.isDuplicate(`bulk-${i}`, now);
    }

    // Age everything past the 300s window with one more insert.
    const later = t0 + 301_000;
    expect(deduper.isDuplicate("fresh", later)).toBe(false);
    // m1 was evicted by age → no longer a duplicate.
    expect(deduper.isDuplicate("m1", later)).toBe(false);
  });

  it("treats empty ids as duplicates", () => {
    const deduper = new InboundDeduper();
    expect(deduper.isDuplicate("")).toBe(true);
  });
});
