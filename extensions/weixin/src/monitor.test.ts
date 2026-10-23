import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LookupFn } from "paleoclaw/plugin-sdk/weixin";
import { describe, expect, it, vi } from "vitest";
import { ContextTokenStore } from "./context-tokens.js";
import { WeixinMonitor } from "./monitor.js";
import type { ResolvedWeixinAccount, WeixinIlinkMessage } from "./types.js";

/** Hermetic DNS resolver so the SSRF guard never hits the real network. */
const fakeLookup = (async () => [{ address: "93.184.216.34", family: 4 }]) as unknown as LookupFn;

function makeAccount(overrides: Partial<ResolvedWeixinAccount> = {}): ResolvedWeixinAccount {
  return {
    accountId: "default",
    botId: "bot@im.bot",
    enabled: true,
    token: "tok",
    baseUrl: "https://ilinkai.weixin.qq.com",
    cdnBaseUrl: "https://novac2c.cdn.weixin.qq.com/c2c",
    dmPolicy: "pairing",
    allowFrom: [],
    groupPolicy: "disabled",
    groupAllowFrom: [],
    maxMessageLength: 2000,
    configured: true,
    ...overrides,
  };
}

function dmMessage(from: string, text = "hello"): WeixinIlinkMessage {
  return {
    message_id: `m-${from}-${text}`,
    from_user_id: from,
    to_user_id: "bot@im.bot",
    msg_type: 1,
    context_token: `ctx-${from}`,
    item_list: [{ type: 1, text_item: { text } }],
  };
}

/** iLink fake transport: records every call and answers with a benign OK. */
function fakeIlinkFetch() {
  const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
  const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
    });
    return new Response(JSON.stringify({ ret: 0, errcode: 0 }), { status: 200 });
  });
  return { fetchImpl, calls };
}

async function makeStore(): Promise<ContextTokenStore> {
  const dir = await mkdtemp(join(tmpdir(), "weixin-monitor-"));
  return new ContextTokenStore(dir);
}

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("waitFor timed out");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("weixin monitor DM access control", () => {
  it("does not dispatch an unknown sender under the default pairing policy and asks for a pairing code", async () => {
    const { fetchImpl, calls } = fakeIlinkFetch();
    const delivered: string[] = [];
    const pairingRequests: Array<{ id: string }> = [];
    const monitor = new WeixinMonitor({
      account: makeAccount(),
      contextTokens: await makeStore(),
      deliver: async (message) => {
        delivered.push(message.senderId);
      },
      pairing: {
        readStoreForDmPolicy: async () => [],
        upsertPairingRequest: async (input) => {
          pairingRequests.push({ id: input.id });
          return { code: "ABCD12", created: true };
        },
      },
      fetchImpl,
      lookupFn: fakeLookup,
    });

    await monitor.processMessageSafe(dmMessage("stranger"));

    expect(delivered).toEqual([]);
    expect(pairingRequests).toEqual([{ id: "stranger" }]);
    // The pairing code is delivered back to the sender via sendmessage.
    const reply = calls.find((call) => call.url.includes("sendmessage"));
    expect(reply?.body?.msg).toBeDefined();
    expect(JSON.stringify(reply?.body)).toContain("ABCD12");
  });

  it("dispatches any sender when the allowlist holds the '*' wildcard", async () => {
    const { fetchImpl } = fakeIlinkFetch();
    const delivered: string[] = [];
    const monitor = new WeixinMonitor({
      account: makeAccount({ dmPolicy: "allowlist", allowFrom: ["*"] }),
      contextTokens: await makeStore(),
      deliver: async (message) => {
        delivered.push(message.senderId);
      },
      pairing: {
        readStoreForDmPolicy: async () => [],
        upsertPairingRequest: async () => ({ code: "XXXXXX", created: true }),
      },
      fetchImpl,
      lookupFn: fakeLookup,
    });

    await monitor.processMessageSafe(dmMessage("anyone"));

    expect(delivered).toEqual(["anyone"]);
  });

  it("blocks a sender that is not on the allowlist", async () => {
    const { fetchImpl } = fakeIlinkFetch();
    const delivered: string[] = [];
    const monitor = new WeixinMonitor({
      account: makeAccount({ dmPolicy: "allowlist", allowFrom: ["bob"] }),
      contextTokens: await makeStore(),
      deliver: async (message) => {
        delivered.push(message.senderId);
      },
      pairing: {
        readStoreForDmPolicy: async () => [],
        upsertPairingRequest: async () => ({ code: "XXXXXX", created: true }),
      },
      fetchImpl,
      lookupFn: fakeLookup,
    });

    await monitor.processMessageSafe(dmMessage("alice"));

    expect(delivered).toEqual([]);
  });

  it("dispatches a sender approved through the pairing store", async () => {
    const { fetchImpl } = fakeIlinkFetch();
    const delivered: string[] = [];
    const pairingRequests: string[] = [];
    const monitor = new WeixinMonitor({
      account: makeAccount(),
      contextTokens: await makeStore(),
      deliver: async (message) => {
        delivered.push(message.senderId);
      },
      pairing: {
        readStoreForDmPolicy: async () => ["alice"],
        upsertPairingRequest: async (input) => {
          pairingRequests.push(input.id);
          return { code: "XXXXXX", created: true };
        },
      },
      fetchImpl,
      lookupFn: fakeLookup,
    });

    await monitor.processMessageSafe(dmMessage("alice"));

    expect(delivered).toEqual(["alice"]);
    // An approved sender must not be asked to pair again.
    expect(pairingRequests).toEqual([]);
  });

  it("keeps dmPolicy=open open for everyone", async () => {
    const { fetchImpl } = fakeIlinkFetch();
    const delivered: string[] = [];
    const monitor = new WeixinMonitor({
      account: makeAccount({ dmPolicy: "open" }),
      contextTokens: await makeStore(),
      deliver: async (message) => {
        delivered.push(message.senderId);
      },
      fetchImpl,
      lookupFn: fakeLookup,
    });

    await monitor.processMessageSafe(dmMessage("anyone"));

    expect(delivered).toEqual(["anyone"]);
  });
});

describe("weixin monitor lifecycle", () => {
  it("stop() returns promptly while the 10-minute session-expired pause is active", async () => {
    const logs: string[] = [];
    const monitor = new WeixinMonitor({
      account: makeAccount(),
      contextTokens: await makeStore(),
      deliver: async () => {},
      fetchImpl: async () =>
        new Response(JSON.stringify({ ret: -14, errmsg: "session expired" }), { status: 200 }),
      lookupFn: fakeLookup,
      log: {
        info: (msg) => logs.push(String(msg)),
        warn: (msg) => logs.push(String(msg)),
        error: (msg) => logs.push(String(msg)),
      },
    });

    void monitor.start();
    await waitFor(() => logs.some((line) => line.includes("session expired")));

    const startedAt = Date.now();
    await monitor.stop();
    expect(Date.now() - startedAt).toBeLessThan(3000);
  });

  it("treats an upstream HTTP 401 as a failure instead of a healthy empty poll", async () => {
    const errors: string[] = [];
    const monitor = new WeixinMonitor({
      account: makeAccount(),
      contextTokens: await makeStore(),
      deliver: async () => {},
      fetchImpl: async () => new Response("unauthorized", { status: 401 }),
      lookupFn: fakeLookup,
      log: {
        info: () => {},
        warn: () => {},
        error: (msg) => errors.push(String(msg)),
      },
    });

    void monitor.start();
    await waitFor(() => errors.some((line) => line.includes("poll error")));

    expect(errors[0]).toContain("401");
    await monitor.stop();
  });
});
