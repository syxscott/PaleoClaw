import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QqbotClient } from "./client.js";
import { QqbotGateway } from "./gateway.js";
import { QqbotTokenManager, type QqbotFetchLike } from "./token.js";

type SentPayload = Record<string, unknown>;

function makeHarness() {
  const sent: SentPayload[] = [];
  const dispatches: Array<{ eventType: string; d: unknown; seq?: number }> = [];
  const states: Array<{ state: string; detail?: string }> = [];

  const tokenFetch: QqbotFetchLike = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ access_token: "TESTTOKEN", expires_in: 7200 }),
    text: async () => JSON.stringify({ access_token: "TESTTOKEN", expires_in: 7200 }),
  });

  const tokenManager = new QqbotTokenManager({
    appId: "app-1",
    clientSecret: "secret-1",
    fetchImpl: tokenFetch,
  });
  const client = new QqbotClient({ tokenManager, apiBase: "https://api.sgroup.qq.com" });

  const gateway = new QqbotGateway({
    client,
    tokenManager,
    intents: (1 << 25) | (1 << 30),
    events: {
      onDispatch: (eventType, d, seq) => {
        dispatches.push({ eventType, d, seq });
      },
      onState: (state, detail) => {
        states.push({ state, detail });
      },
    },
  });

  // Tests drive handlePayload/handleClose directly (no start()), so attach the
  // fake transport manually — mirroring the post-open state of the real flow.
  gateway.socket = {
    send: (data) => {
      sent.push(JSON.parse(data) as SentPayload);
    },
    close: () => undefined,
  };

  return {
    gateway,
    sent,
    dispatches,
    states,
    tokenManager,
  };
}

describe("QqbotGateway payload handling", () => {
  const openGateways: QqbotGateway[] = [];

  function track(harness: ReturnType<typeof makeHarness>) {
    openGateways.push(harness.gateway);
    return harness;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    for (const gateway of openGateways.splice(0)) {
      gateway.stop();
    }
    vi.useRealTimers();
  });

  it("replies to Hello (op 10) with Identify (op 2) carrying token + intents", async () => {
    const harness = track(makeHarness());
    harness.gateway.handlePayload({ op: 10, d: { heartbeat_interval: 30000 } });

    // Identify is sent asynchronously (token fetch) — flush microtasks.
    await vi.advanceTimersByTimeAsync(0);

    expect(harness.gateway.heartbeatIntervalMs).toBe(24000);
    expect(harness.sent).toHaveLength(1);
    const identify = harness.sent[0];
    expect(identify.op).toBe(2);
    expect((identify.d as Record<string, unknown>).token).toBe("QQBot TESTTOKEN");
    expect((identify.d as Record<string, unknown>).intents).toBe((1 << 25) | (1 << 30));
  });

  it("resumes (op 6) when a session id and seq are known", async () => {
    const harness = track(makeHarness());
    harness.gateway.handlePayload({
      op: 0,
      t: "READY",
      s: 1,
      d: { session_id: "sess-1", user: { id: "bot" } },
    });
    harness.gateway.handlePayload({ op: 0, t: "AT_MESSAGE_CREATE", s: 2, d: { id: "m1" } });

    harness.gateway.handlePayload({ op: 10, d: { heartbeat_interval: 30000 } });
    await vi.advanceTimersByTimeAsync(0);

    const resume = harness.sent.find((payload) => payload.op === 6);
    expect(resume).toBeDefined();
    expect(resume?.d).toMatchObject({
      token: "QQBot TESTTOKEN",
      session_id: "sess-1",
      seq: 2,
    });
  });

  it("tracks seq and forwards dispatch events to onDispatch", () => {
    const harness = track(makeHarness());
    harness.gateway.handlePayload({
      op: 0,
      t: "AT_MESSAGE_CREATE",
      s: 41,
      d: { id: "m1", content: "hello" },
    });

    expect(harness.gateway.lastSeq).toBe(41);
    expect(harness.dispatches).toEqual([
      { eventType: "AT_MESSAGE_CREATE", d: { id: "m1", content: "hello" }, seq: 41 },
    ]);
  });

  it("enters connected state on READY and RESUMED without forwarding them", () => {
    const harness = track(makeHarness());
    harness.gateway.handlePayload({ op: 0, t: "READY", s: 1, d: { session_id: "s1" } });
    expect(harness.gateway.state).toBe("connected");
    expect(harness.gateway.sessionId).toBe("s1");

    harness.gateway.handlePayload({ op: 0, t: "RESUMED", s: 2, d: null });
    expect(harness.gateway.state).toBe("connected");
    expect(harness.dispatches).toHaveLength(0);
  });

  it("sends heartbeats with the latest seq at 80% of the Hello interval", async () => {
    const harness = track(makeHarness());
    harness.gateway.handlePayload({
      op: 0,
      t: "READY",
      s: 7,
      d: { session_id: "s1" },
    });
    harness.gateway.handlePayload({ op: 10, d: { heartbeat_interval: 30000 } });

    await vi.advanceTimersByTimeAsync(24000);
    const heartbeat = harness.sent.find((payload) => payload.op === 1);
    expect(heartbeat).toMatchObject({ op: 1, d: 7 });
  });

  it("op 9 (invalid session, not resumable) clears the session", async () => {
    const harness = track(makeHarness());
    harness.gateway.handlePayload({ op: 0, t: "READY", s: 1, d: { session_id: "s1" } });
    harness.gateway.handlePayload({ op: 9, d: false });
    expect(harness.gateway.sessionId).toBeNull();
    expect(harness.gateway.lastSeq).toBeNull();
  });

  it("close code 4004 invalidates the token and schedules a retry", () => {
    const harness = track(makeHarness());
    const invalidateSpy = vi.spyOn(harness.tokenManager, "invalidate");

    harness.gateway.handleClose(4004, "invalid token");

    expect(invalidateSpy).toHaveBeenCalledOnce();
    expect(harness.gateway.reconnect.attempt).toBe(1);
    expect(harness.gateway.reconnect.lastDelay).toBe(2000);
    expect(harness.gateway.state).toBe("reconnecting");
  });

  it("close code 4006 clears the session before reconnecting", () => {
    const harness = track(makeHarness());
    harness.gateway.handlePayload({ op: 0, t: "READY", s: 1, d: { session_id: "s1" } });

    harness.gateway.handleClose(4006, "session invalidated");

    expect(harness.gateway.sessionId).toBeNull();
    expect(harness.gateway.state).toBe("reconnecting");
  });

  it("close code 4001 (fatal) stops reconnecting", () => {
    const harness = track(makeHarness());
    harness.gateway.handleClose(4001, "invalid opcode");

    expect(harness.gateway.state).toBe("fatal");
    const fatalState = harness.states.find((entry) => entry.state === "fatal");
    expect(fatalState?.detail).toBe("invalid opcode");
  });

  it("close code 4008 (rate limited) delays at least 60s", () => {
    const harness = track(makeHarness());
    harness.gateway.handleClose(4008, "rate limited");
    expect(harness.gateway.reconnect.lastDelay).toBeGreaterThanOrEqual(60000);
    harness.gateway.stop();
  });

  it("escalates the backoff ladder across consecutive failures", () => {
    const harness = track(makeHarness());
    harness.gateway.handleClose(1005, "gone");
    expect(harness.gateway.reconnect.lastDelay).toBe(2000);

    // Simulate the retry timer firing into a failing reconnect.
    harness.gateway.handleClose(1005, "gone again");
    expect(harness.gateway.reconnect.lastDelay).toBe(5000);
    expect(harness.gateway.reconnect.attempt).toBe(2);
    harness.gateway.stop();
  });

  it("stop() prevents further reconnect handling", () => {
    const harness = track(makeHarness());
    harness.gateway.stop();
    expect(harness.gateway.state).toBe("stopped");

    harness.gateway.handleClose(1005, "after stop");
    expect(harness.gateway.reconnect.attempt).toBe(0);
    expect(harness.gateway.state).toBe("stopped");
  });

  it("drops malformed JSON frames", () => {
    const harness = track(makeHarness());
    expect(() => harness.gateway.handleRawMessage("not-json{")).not.toThrow();
    expect(harness.dispatches).toHaveLength(0);
  });
});
