import { describe, expect, it, vi } from "vitest";
import {
  buildIlinkHeaders,
  buildSendMessagePayload,
  getUpdates,
  ILINK_APP_CLIENT_VERSION,
  ILINK_APP_ID,
  isSessionExpired,
} from "./ilink.js";

describe("buildIlinkHeaders (port of _headers)", () => {
  it("sets the iLink auth headers and bearer token", () => {
    const body = '{"hello":"world"}';
    const headers = buildIlinkHeaders("tok", body, () => Buffer.from([1, 2, 3, 4]));
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.AuthorizationType).toBe("ilink_bot_token");
    expect(headers["Content-Length"]).toBe(String(Buffer.byteLength(body, "utf8")));
    expect(headers["iLink-App-Id"]).toBe(ILINK_APP_ID);
    expect(headers["iLink-App-ClientVersion"]).toBe(String(ILINK_APP_CLIENT_VERSION));
    expect(headers.Authorization).toBe("Bearer tok");
    // X-WECHAT-UIN = base64 of the 4-byte uin rendered as its decimal string
    expect(headers["X-WECHAT-UIN"]).toBe(Buffer.from("16909060", "utf8").toString("base64"));
  });

  it("omits Authorization when no token", () => {
    const headers = buildIlinkHeaders(undefined, "{}", () => Buffer.from([0, 0, 0, 0]));
    expect(headers.Authorization).toBeUndefined();
  });

  it("uses the injected uin source deterministically", () => {
    const a = buildIlinkHeaders("t", "{}", () => Buffer.from([9, 9, 9, 9]));
    const b = buildIlinkHeaders("t", "{}", () => Buffer.from([9, 9, 9, 9]));
    expect(a["X-WECHAT-UIN"]).toBe(b["X-WECHAT-UIN"]);
  });
});

describe("buildSendMessagePayload (port of _send_message)", () => {
  it("wraps the text item with bot message type and context_token", () => {
    const payload = buildSendMessagePayload({
      to: "peer",
      text: "hi",
      contextToken: "CTX",
      clientId: "cid",
    });
    expect(payload).toEqual({
      msg: {
        from_user_id: "",
        to_user_id: "peer",
        client_id: "cid",
        message_type: 2,
        message_state: 2,
        item_list: [{ type: 1, text_item: { text: "hi" } }],
        context_token: "CTX",
      },
    });
  });

  it("omits context_token when absent", () => {
    const payload = buildSendMessagePayload({ to: "peer", text: "hi", clientId: "cid" });
    expect(payload.msg).not.toHaveProperty("context_token");
  });

  it("rejects empty text", () => {
    expect(() => buildSendMessagePayload({ to: "p", text: "  ", clientId: "c" })).toThrow(
      "text must not be empty",
    );
  });
});

describe("isSessionExpired (port of _is_session_expired)", () => {
  it("detects errcode/ret -14", () => {
    expect(isSessionExpired({}, -14, 0)).toBe(true);
    expect(isSessionExpired({}, 0, -14)).toBe(true);
  });

  it("treats -2 with 'unknown error' as stale session", () => {
    expect(isSessionExpired({ errmsg: "unknown error" }, -2, 0)).toBe(true);
    expect(isSessionExpired({ errmsg: "Unknown Error" }, 0, -2)).toBe(true);
  });

  it("treats -2 with a real message as a rate limit, not expiry", () => {
    expect(isSessionExpired({ errmsg: "rate limited" }, -2, 0)).toBe(false);
  });

  it("returns false for success responses", () => {
    expect(isSessionExpired({ errmsg: "ok" }, 0, 0)).toBe(false);
  });
});

describe("getUpdates", () => {
  it("POSTs the sync cursor and parses msgs", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({ ret: 0, msgs: [{ from_user_id: "alice" }], get_updates_buf: "CURSOR2" }),
        { status: 200 },
      );
    });
    const result = await getUpdates({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "tok",
      syncBuf: "CURSOR1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.msgs).toHaveLength(1);
    expect(result.get_updates_buf).toBe("CURSOR2");
    expect(calls[0]?.url).toBe("https://ilinkai.weixin.qq.com/ilink/bot/getupdates");
    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(body.get_updates_buf).toBe("CURSOR1");
    expect(body.base_info).toEqual({ channel_version: "2.2.0" });
  });

  it("returns an empty batch on timeout/network failure (ported semantics)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });
    const result = await getUpdates({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "tok",
      syncBuf: "CURSOR1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ret).toBe(0);
    expect(result.msgs).toEqual([]);
    expect(result.get_updates_buf).toBe("CURSOR1");
  });

  it("propagates non-zero ret codes for the monitor to classify", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ ret: -14, errmsg: "session expired" }), { status: 200 }),
    );
    const result = await getUpdates({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "tok",
      syncBuf: "",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ret).toBe(-14);
  });
});
