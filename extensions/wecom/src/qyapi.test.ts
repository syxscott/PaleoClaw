import { describe, expect, it, vi } from "vitest";
import {
  AccessTokenManager,
  buildMarkdownMessagePayload,
  buildTextMessagePayload,
  sendWecomMessage,
  sendWecomPayload,
  truncateContent,
  type FetchLike,
} from "./qyapi.js";
import type { ResolvedWecomAccount } from "./types.js";

type RecordedCall = { url: string; init?: RequestInit };

type FetchMock = {
  fetch: FetchLike;
  raw: ReturnType<typeof vi.fn>;
  calls: RecordedCall[];
};

function makeAccount(): ResolvedWecomAccount {
  return {
    accountId: "default",
    enabled: true,
    corpId: "wwcorp",
    agentId: "1000002",
    secret: "shhh",
    token: "t",
    encodingAesKey: "k",
    callbackPath: "/wecom/callback",
    dmPolicy: "allowlist",
    allowFrom: [],
    outboundMsgType: "text",
    configured: true,
  };
}

function jsonFetch(response: unknown): FetchMock {
  return queueJsonFetch([response]);
}

/** Fetch mock that returns queued responses in call order (last one repeats). */
function queueJsonFetch(responses: unknown[]): FetchMock {
  const calls: RecordedCall[] = [];
  const raw = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const index = Math.min(calls.length, responses.length - 1);
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(responses[index]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  return { fetch: raw as unknown as FetchLike, raw, calls };
}

describe("outbound payload builders", () => {
  it("builds a text message/send payload", () => {
    const payload = buildTextMessagePayload({
      touser: "zhangsan",
      agentId: "1000002",
      content: "hello",
    });
    expect(payload).toEqual({
      touser: "zhangsan",
      msgtype: "text",
      agentid: 1000002,
      text: { content: "hello" },
      safe: 0,
    });
  });

  it("builds a markdown message/send payload", () => {
    const payload = buildMarkdownMessagePayload({
      touser: "zhangsan",
      agentId: 1000002,
      content: "# heading\nbody",
    });
    expect(payload.msgtype).toBe("markdown");
    expect(payload.markdown).toEqual({ content: "# heading\nbody" });
    expect(payload.agentid).toBe(1000002);
  });

  it("truncates content at the 2048-char WeCom limit", () => {
    const long = "x".repeat(3000);
    expect(truncateContent(long).length).toBe(2048);
    const payload = buildTextMessagePayload({ touser: "a", agentId: 1, content: long });
    expect(payload.text.content.length).toBe(2048);
  });
});

describe("AccessTokenManager", () => {
  it("fetches and caches the access token with early refresh", async () => {
    const { fetch: fetchImpl, calls } = jsonFetch({
      errcode: 0,
      access_token: "TOKEN_1",
      expires_in: 7200,
    });
    const manager = new AccessTokenManager({ fetchImpl });
    const account = { accountId: "default", corpId: "wwcorp", secret: "shhh" };

    const token1 = await manager.getToken(account);
    expect(token1).toBe("TOKEN_1");
    expect(calls[0]?.url).toContain("https://qyapi.weixin.qq.com/cgi-bin/gettoken");
    expect(calls[0]?.url).toContain("corpid=wwcorp");
    expect(calls[0]?.url).toContain("corpsecret=shhh");

    // Cached: no second network call.
    const token2 = await manager.getToken(account);
    expect(token2).toBe("TOKEN_1");
    expect(calls).toHaveLength(1);
  });

  it("refreshes when the token is close to expiry", async () => {
    const responses = [
      { errcode: 0, access_token: "SHORT_LIVED", expires_in: 30 },
      { errcode: 0, access_token: "REFRESHED", expires_in: 7200 },
    ];
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(String(url));
      const body = responses[Math.min(calls.length - 1, responses.length - 1)];
      return new Response(JSON.stringify(body), { status: 200 });
    };
    const manager = new AccessTokenManager({ fetchImpl });
    const account = { accountId: "default", corpId: "wwcorp", secret: "shhh" };

    expect(await manager.getToken(account)).toBe("SHORT_LIVED");
    // expires_in=30s is inside the 60s early-refresh window → immediate refresh.
    expect(await manager.getToken(account)).toBe("REFRESHED");
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("throws on non-zero errcode", async () => {
    const { fetch: fetchImpl } = jsonFetch({ errcode: 40013, errmsg: "invalid corpid" });
    const manager = new AccessTokenManager({ fetchImpl });
    await expect(
      manager.getToken({ accountId: "default", corpId: "bad", secret: "bad" }),
    ).rejects.toThrow("40013");
  });
});

describe("sendWecomPayload / sendWecomMessage", () => {
  it("POSTs to message/send with the access token and returns ok", async () => {
    const { fetch: fetchImpl, calls } = queueJsonFetch([
      { errcode: 0, access_token: "TOKEN_1", expires_in: 7200 },
      { errcode: 0, msgid: "MSG_1" },
    ]);
    const tokenManager = new AccessTokenManager({ fetchImpl });
    // Prime the token cache (call #1: gettoken).
    await tokenManager.getToken({ accountId: "default", corpId: "wwcorp", secret: "shhh" });

    const payload = buildTextMessagePayload({ touser: "zhangsan", agentId: 1, content: "hi" });
    const result = await sendWecomPayload({
      account: { accountId: "default", corpId: "wwcorp", secret: "shhh" },
      payload,
      tokenManager,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageId).toBe("MSG_1");
    }
    const sendCall = calls.at(-1);
    expect(sendCall?.url).toContain("/cgi-bin/message/send?access_token=TOKEN_1");
    const body = JSON.parse(String(sendCall?.init?.body)) as { touser: string };
    expect(body.touser).toBe("zhangsan");
  });

  it("returns an error result on non-zero errcode", async () => {
    const { fetch: fetchImpl } = jsonFetch({ errcode: 81013, errmsg: "user not found" });
    const tokenManager = new AccessTokenManager({ fetchImpl });
    const result = await sendWecomPayload({
      account: { accountId: "default", corpId: "wwcorp", secret: "shhh" },
      payload: buildTextMessagePayload({ touser: "ghost", agentId: 1, content: "hi" }),
      tokenManager,
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("81013");
    }
  });

  it("sendWecomMessage respects account.outboundMsgType", async () => {
    const { fetch: fetchImpl, calls } = queueJsonFetch([
      { errcode: 0, access_token: "TOKEN_1", expires_in: 7200 },
      { errcode: 0, msgid: "M" },
    ]);

    const account = { ...makeAccount(), outboundMsgType: "markdown" as const };
    await sendWecomMessage({ account, toUser: "zhangsan", content: "**bold**", fetchImpl });
    const sendCall = calls.at(-1);
    const body = JSON.parse(String(sendCall?.init?.body)) as { msgtype: string };
    expect(body.msgtype).toBe("markdown");
  });
});
