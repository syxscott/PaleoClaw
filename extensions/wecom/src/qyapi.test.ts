import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AccessTokenManager,
  buildMarkdownMessagePayload,
  buildTextMessagePayload,
  sendWecomMessage,
  sendWecomPayload,
  setWecomTokenManager,
  splitContentByBytes,
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

type QueuedResponse = { status: number; body: unknown };

/** Fetch mock that returns queued responses (with their own HTTP status). */
function queueStatusFetch(responses: QueuedResponse[]): FetchMock {
  const calls: RecordedCall[] = [];
  const raw = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const index = Math.min(calls.length, responses.length - 1);
    calls.push({ url: String(url), init });
    const entry = responses[index]!;
    return new Response(JSON.stringify(entry.body), {
      status: entry.status,
      headers: { "Content-Type": "application/json" },
    });
  });
  return { fetch: raw as unknown as FetchLike, raw, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
  setWecomTokenManager(null);
});

/** True when the text contains a surrogate code unit that is not part of a pair. */
function hasLoneSurrogate(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next < 0xdc00 || next > 0xdfff) {
        return true;
      }
      i += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true; // low surrogate without a preceding high surrogate
    }
  }
  return false;
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

  it("truncates content at the 2048-byte WeCom limit", () => {
    const long = "x".repeat(3000);
    expect(truncateContent(long).length).toBe(2048);
    const payload = buildTextMessagePayload({ touser: "a", agentId: 1, content: long });
    expect(payload.text.content.length).toBe(2048);
  });

  it("truncates on UTF-8 bytes, not characters", () => {
    // 1000 Chinese characters = 3000 UTF-8 bytes > the 2048 byte limit.
    const chinese = "中".repeat(1000);
    const truncated = truncateContent(chinese);
    expect(Buffer.byteLength(truncated, "utf8")).toBeLessThanOrEqual(2048);
    expect(truncated.length).toBeLessThan(chinese.length);
  });

  it("never cuts a surrogate pair in half", () => {
    const emoji = "\u{1F600}";
    const content = "x".repeat(2047) + emoji;
    const truncated = truncateContent(content);
    expect(truncated).toBe("x".repeat(2047));
    // No lone surrogate may survive the cut.
    expect(hasLoneSurrogate(truncated)).toBe(false);
  });
});

describe("splitContentByBytes", () => {
  it("splits a long text into several chunks that each fit the byte limit", () => {
    const long = "x".repeat(5000);
    const chunks = splitContentByBytes(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(long);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk, "utf8")).toBeLessThanOrEqual(2048);
    }
  });

  it("splits Chinese text on the byte budget and keeps the whole text", () => {
    const chinese = "中".repeat(3000);
    const chunks = splitContentByBytes(chinese);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(chinese);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk, "utf8")).toBeLessThanOrEqual(2048);
    }
  });

  it("keeps surrogate pairs intact across chunk boundaries", () => {
    const emoji = "\u{1F600}";
    const content = emoji.repeat(1000);
    const chunks = splitContentByBytes(content);
    expect(chunks.join("")).toBe(content);
    for (const chunk of chunks) {
      expect(hasLoneSurrogate(chunk)).toBe(false);
    }
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

  it("does not reuse a cached token after the secret is rotated", async () => {
    const responses = [
      { errcode: 0, access_token: "TOKEN_OLD", expires_in: 7200 },
      { errcode: 0, access_token: "TOKEN_NEW", expires_in: 7200 },
    ];
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(String(url));
      const body = responses[Math.min(calls.length - 1, responses.length - 1)];
      return new Response(JSON.stringify(body), { status: 200 });
    };
    const manager = new AccessTokenManager({ fetchImpl });

    expect(
      await manager.getToken({ accountId: "default", corpId: "wwcorp", secret: "old-secret" }),
    ).toBe("TOKEN_OLD");
    // The account id is unchanged, but the credentials are not: the cached
    // token was minted for the previous secret and must not be reused.
    expect(
      await manager.getToken({ accountId: "default", corpId: "wwcorp", secret: "new-secret" }),
    ).toBe("TOKEN_NEW");
    expect(calls).toHaveLength(2);
  });

  it("invalidate drops every cached token for the account", async () => {
    const { fetch: fetchImpl, calls } = jsonFetch({
      errcode: 0,
      access_token: "TOKEN_1",
      expires_in: 7200,
    });
    const manager = new AccessTokenManager({ fetchImpl });
    const account = { accountId: "default", corpId: "wwcorp", secret: "shhh" };

    await manager.getToken(account);
    expect(calls).toHaveLength(1);
    manager.invalidate("default");
    await manager.getToken(account);
    expect(calls).toHaveLength(2);
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

describe("sendWecomPayload response validation", () => {
  const payload = buildTextMessagePayload({ touser: "zhangsan", agentId: 1, content: "hi" });
  const account = { accountId: "default", corpId: "wwcorp", secret: "shhh" };

  async function sendWith(response: QueuedResponse) {
    const { fetch: fetchImpl } = queueStatusFetch([
      { status: 200, body: { errcode: 0, access_token: "TOKEN_1", expires_in: 7200 } },
      response,
    ]);
    return await sendWecomPayload({
      account,
      payload,
      tokenManager: new AccessTokenManager({ fetchImpl }),
      fetchImpl,
    });
  }

  it("fails when the response has no errcode", async () => {
    const result = await sendWith({ status: 200, body: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("errcode");
    }
  });

  it("fails when errcode is a string instead of a number", async () => {
    const result = await sendWith({ status: 200, body: { errcode: "40001" } });
    expect(result.ok).toBe(false);
  });

  it("fails on HTTP 500 even with an empty body", async () => {
    const result = await sendWith({ status: 500, body: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("500");
    }
  });

  it("fails on HTTP 401 with an error body", async () => {
    const result = await sendWith({ status: 401, body: { error: "unauthorized" } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("401");
    }
  });
});

describe("shared access-token cache", () => {
  it("fetches the access token only once across two sends", async () => {
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      const raw = String(url);
      calls.push(raw);
      if (raw.includes("/cgi-bin/gettoken")) {
        return new Response(
          JSON.stringify({ errcode: 0, access_token: "TOKEN_1", expires_in: 7200 }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ errcode: 0, msgid: "M" }), { status: 200 });
    };
    vi.stubGlobal("fetch", fetchImpl);
    setWecomTokenManager(null);

    const account = makeAccount();
    const first = await sendWecomMessage({ account, toUser: "zhangsan", content: "one" });
    const second = await sendWecomMessage({ account, toUser: "zhangsan", content: "two" });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(calls.filter((url) => url.includes("/cgi-bin/gettoken"))).toHaveLength(1);
    expect(calls.filter((url) => url.includes("/cgi-bin/message/send"))).toHaveLength(2);
  });
});
