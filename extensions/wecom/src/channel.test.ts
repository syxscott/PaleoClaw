import type { PluginHttpRouteHandler, PluginRuntime } from "paleoclaw/plugin-sdk/wecom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWecomPlugin, getWecomRegisteredRoutesForTest } from "./channel.js";
import { WxBizMsgCrypt } from "./crypto.js";
import { AccessTokenManager, setWecomTokenManager } from "./qyapi.js";
import { setWecomRuntime } from "./runtime.js";
import { flushAsync, makeReq, makeRes, type MockRes } from "./test-http-utils.js";
import { buildXmlEnvelope } from "./xml.js";

const CORP_ID = "ww1234567890abcdef";
const TOKEN = "testtoken";
const AES_KEY_43 = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopq";
const NONCE = "nonce12345";
const RANDOM_PREFIX = Buffer.alloc(16, 0xab);

type RuntimeCalls = {
  finalized: Record<string, unknown>[];
  dispatched: number;
  replyText: string;
};

function makeCalls(): RuntimeCalls {
  return { finalized: [], dispatched: 0, replyText: "" };
}

/** Minimal PluginRuntime stand-in that records what reached the agent. */
function makeRuntime(cfg: unknown, calls: RuntimeCalls, storeAllowFrom: string[] = []) {
  return {
    config: { loadConfig: () => cfg },
    channel: {
      pairing: {
        readAllowFromStore: async () => storeAllowFrom,
        upsertPairingRequest: async () => ({ code: "PAIRING-CODE", created: true }),
        buildPairingReply: () => "pairing reply",
      },
      commands: { shouldHandleTextCommands: () => true },
      text: { hasControlCommand: () => false },
      reply: {
        finalizeInboundContext: (ctx: Record<string, unknown>) => {
          calls.finalized.push(ctx);
          return ctx;
        },
        dispatchReplyWithBufferedBlockDispatcher: async (args: {
          dispatcherOptions: { deliver: (payload: { text?: string }) => Promise<void> };
        }) => {
          calls.dispatched += 1;
          await args.dispatcherOptions.deliver({ text: calls.replyText });
        },
      },
    },
  } as unknown as PluginRuntime;
}

function makeCfg(wecom: Record<string, unknown>): Record<string, unknown> {
  return { channels: { wecom } };
}

function makeLog() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

async function startAccount(accountId: string, cfg: unknown) {
  const plugin = createWecomPlugin();
  const controller = new AbortController();
  const promise = plugin.gateway.startAccount({
    cfg,
    accountId,
    log: makeLog(),
    abortSignal: controller.signal,
  });
  await flushAsync();
  return { controller, promise };
}

async function stopAccount(controller: AbortController, promise: Promise<unknown>) {
  controller.abort();
  await promise;
}

function makeCrypt(token: string, corpId: string): WxBizMsgCrypt {
  return new WxBizMsgCrypt({
    token,
    encodingAesKey: AES_KEY_43,
    receiveId: corpId,
  });
}

async function postCallback(params: {
  route: { path: string; handler: PluginHttpRouteHandler };
  xml: string;
  token?: string;
  corpId?: string;
  timestamp?: string;
}): Promise<MockRes> {
  const token = params.token ?? TOKEN;
  const corpId = params.corpId ?? CORP_ID;
  const crypt = makeCrypt(token, corpId);
  const timestamp = params.timestamp ?? String(Math.floor(Date.now() / 1000));
  const body = crypt.buildEncryptedEnvelope(params.xml, {
    nonce: NONCE,
    timestamp,
    randomPrefix: RANDOM_PREFIX,
  });
  const signature = /<MsgSignature>([^<]+)<\/MsgSignature>/.exec(body)?.[1] ?? "";
  const res = makeRes();
  await params.route.handler(
    makeReq(
      "POST",
      `${params.route.path}?msg_signature=${signature}&timestamp=${timestamp}&nonce=${NONCE}`,
      body,
    ),
    res,
  );
  await flushAsync();
  return res;
}

function textMessageXml(fields: Record<string, string> = {}): string {
  return buildXmlEnvelope({
    ToUserName: CORP_ID,
    FromUserName: "zhangsan",
    CreateTime: "1700000000",
    MsgType: "text",
    Content: "hello bot",
    MsgId: "900010",
    ...fields,
  });
}

/** fetch mock that records the outbound WeCom calls. */
function makeFetchMock() {
  const calls: { url: string; body: string }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const raw = String(url);
    calls.push({ url: raw, body: String(init?.body ?? "") });
    if (raw.includes("/cgi-bin/gettoken")) {
      return new Response(
        JSON.stringify({ errcode: 0, access_token: "TOKEN_1", expires_in: 7200 }),
        {
          status: 200,
        },
      );
    }
    return new Response(JSON.stringify({ errcode: 0, msgid: "MSG_1" }), { status: 200 });
  });
  return { impl, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
  setWecomTokenManager(null);
});

describe("WeCom inbound access control (dmPolicy / allowFrom)", () => {
  it("does not dispatch a sender that is not on the allowlist", async () => {
    const cfg = makeCfg({
      corpId: CORP_ID,
      secret: "s3cret",
      agentId: "1000002",
      token: TOKEN,
      encodingAesKey: AES_KEY_43,
      dmPolicy: "allowlist",
      allowFrom: ["zhangsan"],
    });
    const calls = makeCalls();
    setWecomRuntime(makeRuntime(cfg, calls));

    const { controller, promise } = await startAccount("default", cfg);
    try {
      const route = getWecomRegisteredRoutesForTest()[0];
      expect(route).toBeDefined();
      const res = await postCallback({
        route: route!,
        xml: textMessageXml({ FromUserName: "lisi" }),
      });
      // The callback is acknowledged, but the agent never sees the message.
      expect(res._status).toBe(200);
      expect(calls.finalized).toHaveLength(0);
      expect(calls.dispatched).toBe(0);
    } finally {
      await stopAccount(controller, promise);
    }
  });

  it("dispatches a sender that is on the allowlist", async () => {
    const cfg = makeCfg({
      corpId: CORP_ID,
      secret: "s3cret",
      agentId: "1000002",
      token: TOKEN,
      encodingAesKey: AES_KEY_43,
      dmPolicy: "allowlist",
      allowFrom: ["zhangsan"],
    });
    const calls = makeCalls();
    setWecomRuntime(makeRuntime(cfg, calls));

    const { controller, promise } = await startAccount("default", cfg);
    try {
      const route = getWecomRegisteredRoutesForTest()[0];
      const res = await postCallback({ route: route!, xml: textMessageXml() });
      expect(res._status).toBe(200);
      expect(calls.finalized).toHaveLength(1);
      expect(calls.dispatched).toBe(1);
      expect(calls.finalized[0]?.CommandAuthorized).toBe(true);
      expect(calls.finalized[0]?.ChatType).toBe("direct");
    } finally {
      await stopAccount(controller, promise);
    }
  });

  it("blocks every sender when the allowlist is empty", async () => {
    const cfg = makeCfg({
      corpId: CORP_ID,
      secret: "s3cret",
      agentId: "1000002",
      token: TOKEN,
      encodingAesKey: AES_KEY_43,
      dmPolicy: "allowlist",
      allowFrom: [],
    });
    const calls = makeCalls();
    setWecomRuntime(makeRuntime(cfg, calls));

    const { controller, promise } = await startAccount("default", cfg);
    try {
      const route = getWecomRegisteredRoutesForTest()[0];
      await postCallback({ route: route!, xml: textMessageXml() });
      expect(calls.finalized).toHaveLength(0);
      expect(calls.dispatched).toBe(0);
    } finally {
      await stopAccount(controller, promise);
    }
  });

  it("blocks every sender when dmPolicy is disabled", async () => {
    const cfg = makeCfg({
      corpId: CORP_ID,
      secret: "s3cret",
      agentId: "1000002",
      token: TOKEN,
      encodingAesKey: AES_KEY_43,
      dmPolicy: "disabled",
      allowFrom: ["zhangsan"],
    });
    const calls = makeCalls();
    setWecomRuntime(makeRuntime(cfg, calls));

    const { controller, promise } = await startAccount("default", cfg);
    try {
      const route = getWecomRegisteredRoutesForTest()[0];
      await postCallback({ route: route!, xml: textMessageXml() });
      expect(calls.finalized).toHaveLength(0);
      expect(calls.dispatched).toBe(0);
    } finally {
      await stopAccount(controller, promise);
    }
  });

  it("issues a pairing challenge instead of dispatching when dmPolicy is pairing", async () => {
    const cfg = makeCfg({
      corpId: CORP_ID,
      secret: "s3cret",
      agentId: "1000002",
      token: TOKEN,
      encodingAesKey: AES_KEY_43,
      dmPolicy: "pairing",
      allowFrom: [],
    });
    const calls = makeCalls();
    setWecomRuntime(makeRuntime(cfg, calls));

    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock.impl);
    setWecomTokenManager(new AccessTokenManager({ fetchImpl: fetchMock.impl as never }));

    const { controller, promise } = await startAccount("default", cfg);
    try {
      const route = getWecomRegisteredRoutesForTest()[0];
      const res = await postCallback({ route: route!, xml: textMessageXml() });
      expect(res._status).toBe(200);
      // The agent never runs, but the sender gets a pairing code.
      expect(calls.finalized).toHaveLength(0);
      expect(calls.dispatched).toBe(0);
      const sends = fetchMock.calls.filter((call) => call.url.includes("/cgi-bin/message/send"));
      expect(sends).toHaveLength(1);
      const body = JSON.parse(sends[0]!.body) as { touser: string; text: { content: string } };
      expect(body.touser).toBe("zhangsan");
      expect(body.text.content).toContain("PAIRING-CODE");
    } finally {
      await stopAccount(controller, promise);
    }
  });

  it("does not dispatch a group callback as a direct message", async () => {
    const cfg = makeCfg({
      corpId: CORP_ID,
      secret: "s3cret",
      agentId: "1000002",
      token: TOKEN,
      encodingAesKey: AES_KEY_43,
      dmPolicy: "open",
    });
    const calls = makeCalls();
    setWecomRuntime(makeRuntime(cfg, calls));

    const { controller, promise } = await startAccount("default", cfg);
    try {
      const route = getWecomRegisteredRoutesForTest()[0];
      const res = await postCallback({
        route: route!,
        xml: textMessageXml({ ChatType: "group" }),
      });
      expect(res._status).toBe(200);
      expect(calls.finalized).toHaveLength(0);
      expect(calls.dispatched).toBe(0);
    } finally {
      await stopAccount(controller, promise);
    }
  });
});

describe("WeCom callback route registration", () => {
  it("registers one distinct route per account when no callbackPath is configured", async () => {
    const cfg = makeCfg({
      accounts: {
        a: {
          corpId: "wwcorpA",
          secret: "secretA",
          agentId: "1000002",
          token: "tokenA",
          encodingAesKey: AES_KEY_43,
        },
        b: {
          corpId: "wwcorpB",
          secret: "secretB",
          agentId: "1000003",
          token: "tokenB",
          encodingAesKey: AES_KEY_43,
        },
      },
    });
    const calls = makeCalls();
    setWecomRuntime(makeRuntime(cfg, calls));

    const started = await startAccount("a", cfg);
    const second = await startAccount("b", cfg);
    try {
      const routes = getWecomRegisteredRoutesForTest();
      expect(routes).toHaveLength(2);
      const paths = routes.map((route) => route.path);
      expect(new Set(paths).size).toBe(2);
      expect(routes.map((route) => route.accountId).toSorted()).toEqual(["a", "b"]);

      // Each route verifies with its own account credentials: account A's
      // signed callback is accepted on A's route and rejected on B's route.
      const routeA = routes.find((route) => route.accountId === "a")!;
      const routeB = routes.find((route) => route.accountId === "b")!;
      const xmlA = buildXmlEnvelope({
        ToUserName: "wwcorpA",
        FromUserName: "zhangsan",
        MsgType: "text",
        Content: "for a",
        MsgId: "910001",
      });
      const accepted = await postCallback({
        route: routeA,
        xml: xmlA,
        token: "tokenA",
        corpId: "wwcorpA",
      });
      expect(accepted._status).toBe(200);

      const rejected = await postCallback({
        route: routeB,
        xml: xmlA,
        token: "tokenA",
        corpId: "wwcorpA",
      });
      expect(rejected._status).toBe(400);
    } finally {
      await stopAccount(started.controller, started.promise);
      await stopAccount(second.controller, second.promise);
    }
  });
});

describe("WeCom outbound delivery", () => {
  it("splits a long reply into several messages instead of losing the tail", async () => {
    const cfg = makeCfg({
      corpId: CORP_ID,
      secret: "s3cret",
      agentId: "1000002",
      token: TOKEN,
      encodingAesKey: AES_KEY_43,
      dmPolicy: "open",
    });
    const calls = makeCalls();
    calls.replyText = "x".repeat(5000);
    setWecomRuntime(makeRuntime(cfg, calls));

    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock.impl);
    setWecomTokenManager(new AccessTokenManager({ fetchImpl: fetchMock.impl as never }));

    const { controller, promise } = await startAccount("default", cfg);
    try {
      const route = getWecomRegisteredRoutesForTest()[0];
      await postCallback({ route: route!, xml: textMessageXml() });

      const sends = fetchMock.calls.filter((call) => call.url.includes("/cgi-bin/message/send"));
      expect(sends.length).toBeGreaterThan(1);
      const delivered = sends
        .map((call) => (JSON.parse(call.body) as { text: { content: string } }).text.content)
        .join("");
      expect(delivered).toBe("x".repeat(5000));
      for (const call of sends) {
        const content = (JSON.parse(call.body) as { text: { content: string } }).text.content;
        expect(Buffer.byteLength(content, "utf8")).toBeLessThanOrEqual(2048);
      }
    } finally {
      await stopAccount(controller, promise);
    }
  });
});
