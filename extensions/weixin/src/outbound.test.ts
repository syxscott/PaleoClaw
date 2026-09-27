import { describe, expect, it, vi } from "vitest";
import { createWeixinOutbound } from "./outbound.js";

/** Fetch mock queue: last response repeats. */
function queueFetch(responses: Array<Record<string, unknown>>) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const index = Math.min(calls.length, responses.length - 1);
    calls.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    });
    return new Response(JSON.stringify(responses[index]), { status: 200 });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

function makeOutbound() {
  return createWeixinOutbound();
}

describe("weixin outbound sendTextChunks", () => {
  it("sends one chunk with the peer's context_token", async () => {
    const { fetchImpl, calls } = queueFetch([{ ret: 0, errcode: 0 }]);
    const outbound = makeOutbound();
    const result = await outbound.sendTextChunks({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "tok",
      to: "alice",
      text: "你好",
      maxMessageLength: 2000,
      contextToken: "CTX_ALICE",
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageIds).toHaveLength(1);
    }
    expect(calls[0]?.url).toContain("ilink/bot/sendmessage");
    const msg = calls[0]?.body.msg as Record<string, unknown>;
    expect(msg.context_token).toBe("CTX_ALICE");
    expect(msg.to_user_id).toBe("alice");
  });

  it("chunks long content into multiple sendmessage calls", async () => {
    const { fetchImpl, calls } = queueFetch([
      { ret: 0, errcode: 0 },
      { ret: 0, errcode: 0 },
    ]);
    const outbound = makeOutbound();
    const longText = Array.from({ length: 30 }, (_, i) => `第${i}段 ${"y".repeat(90)}`).join(
      "\n\n",
    );
    const result = await outbound.sendTextChunks({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "tok",
      to: "alice",
      text: longText,
      maxMessageLength: 400,
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(calls.length).toBeGreaterThan(1);
    for (const call of calls) {
      const msg = call.body.msg as { item_list: Array<{ text_item: { text: string } }> };
      expect(msg.item_list[0]?.text_item.text.length).toBeLessThanOrEqual(400);
    }
  });

  it("retries once without context_token on session expiry (-14)", async () => {
    const { fetchImpl, calls } = queueFetch([
      { ret: -14, errcode: 0, errmsg: "session expired" },
      { ret: 0, errcode: 0 },
    ]);
    const outbound = makeOutbound();
    const result = await outbound.sendTextChunks({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "tok",
      to: "alice",
      text: "hello",
      maxMessageLength: 2000,
      contextToken: "STALE",
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
    const first = calls[0]?.body.msg as Record<string, unknown>;
    const second = calls[1]?.body.msg as Record<string, unknown>;
    expect(first.context_token).toBe("STALE");
    expect(second.context_token).toBeUndefined();
  });

  it("retries once without context_token on -2 'unknown error' (stale session)", async () => {
    const { fetchImpl, calls } = queueFetch([
      { ret: 0, errcode: -2, errmsg: "unknown error" },
      { ret: 0, errcode: 0 },
    ]);
    const outbound = makeOutbound();
    const result = await outbound.sendTextChunks({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "tok",
      to: "alice",
      text: "hello",
      maxMessageLength: 2000,
      contextToken: "STALE",
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("fails with the iLink error on non-zero ret", async () => {
    const { fetchImpl } = queueFetch([{ ret: 0, errcode: -2, errmsg: "rate limited" }]);
    const outbound = makeOutbound();
    const result = await outbound.sendTextChunks({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "tok",
      to: "alice",
      text: "hello",
      maxMessageLength: 2000,
      contextToken: null,
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("errcode=-2");
    }
  });

  it("rejects empty content", async () => {
    const { fetchImpl } = queueFetch([]);
    const outbound = makeOutbound();
    const result = await outbound.sendTextChunks({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "tok",
      to: "alice",
      text: "   ",
      maxMessageLength: 2000,
      fetchImpl,
    });
    expect(result.ok).toBe(false);
  });
});

describe("weixin outbound plugin sendText", () => {
  it("throws when the account is not configured", async () => {
    const outbound = makeOutbound();
    await expect(
      outbound.sendText({ to: "alice", text: "hi", cfg: { channels: { weixin: {} } } }),
    ).rejects.toThrow("not configured");
  });

  it("sends via iLink when configured", async () => {
    const { fetchImpl, calls } = queueFetch([{ ret: 0, errcode: 0 }]);
    const outbound = makeOutbound();
    const result = await outbound.sendText({
      to: "alice",
      text: "你好",
      cfg: {
        channels: {
          weixin: { token: "tok", botId: "bot@im.bot" },
        },
      },
      fetchImpl,
    });
    expect(result.channel).toBe("weixin");
    expect(result.chatId).toBe("alice");
    expect(calls[0]?.url).toContain("/ilink/bot/sendmessage");
  });
});
