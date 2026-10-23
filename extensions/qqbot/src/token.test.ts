import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QqbotTokenError, QqbotTokenManager, type QqbotFetchLike } from "./token.js";

const TOKEN_URL = "https://bots.qq.com/app/getAppAccessToken";

type FetchCall = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

function mockFetch(responder: (call: FetchCall) => { status?: number; body: unknown }): {
  fetchImpl: QqbotFetchLike;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetchImpl: QqbotFetchLike = async (url, init) => {
    const call: FetchCall = {
      url,
      method: init?.method,
      headers: init?.headers,
      body: init?.body,
    };
    calls.push(call);
    const response = responder(call);
    const status = response.status ?? 200;
    const raw = typeof response.body === "string" ? response.body : JSON.stringify(response.body);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => JSON.parse(raw) as unknown,
      text: async () => raw,
    };
  };
  return { fetchImpl, calls };
}

describe("QqbotTokenManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("posts a JSON appId/clientSecret body to getAppAccessToken", async () => {
    const { fetchImpl, calls } = mockFetch(() => ({
      body: { access_token: "tok-1", expires_in: 7200 },
    }));
    const manager = new QqbotTokenManager({
      appId: "app-123",
      clientSecret: "sec-456",
      fetchImpl,
    });

    const token = await manager.getToken();
    expect(token).toBe("tok-1");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(TOKEN_URL);
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.headers?.["Content-Type"]).toBe("application/json");
    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({
      appId: "app-123",
      clientSecret: "sec-456",
    });
  });

  it("caches the token until the refresh margin", async () => {
    const { fetchImpl, calls } = mockFetch(() => ({
      body: { access_token: "tok-1", expires_in: 7200 },
    }));
    const manager = new QqbotTokenManager({ appId: "a", clientSecret: "b", fetchImpl });

    await manager.getToken();
    await manager.getToken();
    expect(calls).toHaveLength(1);

    // 7200s ttl, 60s margin → still fresh at ttl-61s.
    vi.advanceTimersByTime((7200 - 61) * 1000);
    await manager.getToken();
    expect(calls).toHaveLength(1);

    // Past the margin → refresh.
    vi.advanceTimersByTime(2 * 1000);
    const refreshed = await manager.getToken();
    expect(refreshed).toBe("tok-1");
    expect(calls).toHaveLength(2);
  });

  it("handles string expires_in values", async () => {
    const { fetchImpl, calls } = mockFetch(() => ({
      body: { access_token: "tok-str", expires_in: "3600" },
    }));
    const manager = new QqbotTokenManager({ appId: "a", clientSecret: "b", fetchImpl });

    await manager.getToken();
    vi.advanceTimersByTime((3600 - 61) * 1000);
    await manager.getToken();
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(2 * 1000);
    await manager.getToken();
    expect(calls).toHaveLength(2);
  });

  it("falls back to the default ttl when expires_in is missing", async () => {
    const { fetchImpl, calls } = mockFetch(() => ({ body: { access_token: "tok-2" } }));
    const manager = new QqbotTokenManager({ appId: "a", clientSecret: "b", fetchImpl });

    await manager.getToken();
    expect(manager.snapshot.expiresAtMs - Date.now()).toBeCloseTo(7200 * 1000, -1);
    expect(calls).toHaveLength(1);
  });

  it("coalesces concurrent refreshes (singleflight)", async () => {
    const { fetchImpl, calls } = mockFetch(() => ({
      body: { access_token: "tok-1", expires_in: 7200 },
    }));
    const manager = new QqbotTokenManager({ appId: "a", clientSecret: "b", fetchImpl });

    const [t1, t2, t3] = await Promise.all([
      manager.getToken(),
      manager.getToken(),
      manager.getToken(),
    ]);
    expect(t1).toBe("tok-1");
    expect(t2).toBe("tok-1");
    expect(t3).toBe("tok-1");
    expect(calls).toHaveLength(1);
  });

  it("invalidate() forces a refetch on the next getToken", async () => {
    let counter = 0;
    const { fetchImpl, calls } = mockFetch(() => {
      counter += 1;
      return { body: { access_token: `tok-${counter}`, expires_in: 7200 } };
    });
    const manager = new QqbotTokenManager({ appId: "a", clientSecret: "b", fetchImpl });

    expect(await manager.getToken()).toBe("tok-1");
    manager.invalidate();
    expect(await manager.getToken()).toBe("tok-2");
    expect(calls).toHaveLength(2);
  });

  it("throws QqbotTokenError when the response is not ok", async () => {
    const { fetchImpl } = mockFetch(() => ({
      status: 400,
      body: { message: "invalid appid" },
    }));
    const manager = new QqbotTokenManager({ appId: "a", clientSecret: "b", fetchImpl });

    await expect(manager.getToken()).rejects.toBeInstanceOf(QqbotTokenError);
    expect(manager.snapshot.lastError).toContain("invalid appid");
  });

  it("throws QqbotTokenError when access_token is missing", async () => {
    const { fetchImpl } = mockFetch(() => ({ body: { expires_in: 7200 } }));
    const manager = new QqbotTokenManager({ appId: "a", clientSecret: "b", fetchImpl });

    await expect(manager.getToken()).rejects.toThrow(/missing access_token/);
  });
});
