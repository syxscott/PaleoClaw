import { describe, expect, it } from "vitest";
import { QqbotReconnectPolicy, classifyQqbotCloseCode } from "./reconnect.js";

describe("classifyQqbotCloseCode", () => {
  it("classifies fatal close codes with reasons", () => {
    expect(classifyQqbotCloseCode(4014)).toEqual({
      kind: "fatal",
      reason: "intent not authorized",
    });
    expect(classifyQqbotCloseCode(4915)).toEqual({ kind: "fatal", reason: "banned" });
    expect(classifyQqbotCloseCode(4001)).toEqual({ kind: "fatal", reason: "invalid opcode" });
  });

  it("classifies rate-limit, invalid-token and session-invalid codes", () => {
    expect(classifyQqbotCloseCode(4008)).toEqual({ kind: "rate-limit" });
    expect(classifyQqbotCloseCode(4004)).toEqual({ kind: "invalid-token" });
    expect(classifyQqbotCloseCode(4006)).toEqual({ kind: "session-invalid" });
    expect(classifyQqbotCloseCode(4007)).toEqual({ kind: "session-invalid" });
    expect(classifyQqbotCloseCode(4910)).toEqual({ kind: "session-invalid" });
  });

  it("treats 4009 (timeout) and 4914 (fatal, not session) precisely", () => {
    // 4009 is resumable per the QQ protocol → generic retry.
    expect(classifyQqbotCloseCode(4009)).toEqual({ kind: "retry" });
    // 4914 is fatal (offline/sandbox-only), not a session-invalid code.
    expect(classifyQqbotCloseCode(4914)).toEqual({ kind: "fatal", reason: "offline/sandbox-only" });
  });

  it("returns retry for unknown or missing codes", () => {
    expect(classifyQqbotCloseCode(1005)).toEqual({ kind: "retry" });
    expect(classifyQqbotCloseCode(undefined)).toEqual({ kind: "retry" });
  });
});

describe("QqbotReconnectPolicy", () => {
  it("walks the backoff ladder 2s → 5s → 10s → 30s → 60s and clamps", () => {
    const policy = new QqbotReconnectPolicy();
    expect(policy.delayForAttempt(1)).toBe(2000);
    expect(policy.delayForAttempt(2)).toBe(5000);
    expect(policy.delayForAttempt(3)).toBe(10000);
    expect(policy.delayForAttempt(4)).toBe(30000);
    expect(policy.delayForAttempt(5)).toBe(60000);
    expect(policy.delayForAttempt(6)).toBe(60000);
    expect(policy.delayForAttempt(50)).toBe(60000);
  });

  it("applies escalating delays via onFailure and resets on onConnected", () => {
    const policy = new QqbotReconnectPolicy();
    const first = policy.onFailure();
    expect(first).toEqual({ kind: "retry", delayMs: 2000, attempt: 1 });
    expect(policy.state).toBe("backoff");

    const second = policy.onFailure();
    expect(second).toEqual({ kind: "retry", delayMs: 5000, attempt: 2 });

    policy.onConnected();
    expect(policy.state).toBe("connected");
    expect(policy.attempt).toBe(0);

    const afterReset = policy.onFailure();
    expect(afterReset).toEqual({ kind: "retry", delayMs: 2000, attempt: 1 });
  });

  it("waits at least the rate-limit delay for 4008 closes", () => {
    const policy = new QqbotReconnectPolicy();
    const decision = policy.onFailure(classifyQqbotCloseCode(4008));
    expect(decision.kind).toBe("retry");
    expect(decision.kind === "retry" && decision.delayMs).toBeGreaterThanOrEqual(60000);
  });

  it("transitions to fatal immediately on fatal close codes", () => {
    const policy = new QqbotReconnectPolicy();
    const decision = policy.onFailure(classifyQqbotCloseCode(4915));
    expect(decision).toEqual({ kind: "fatal", reason: "banned" });
    expect(policy.state).toBe("fatal");

    // Fatal is terminal — later failures keep reporting fatal, never retry.
    const again = policy.onFailure(classifyQqbotCloseCode(1005));
    expect(again).toEqual({ kind: "fatal", reason: "banned" });
  });

  it("gives up after maxAttempts", () => {
    const policy = new QqbotReconnectPolicy({ maxAttempts: 3 });
    expect(policy.onFailure()?.kind).toBe("retry");
    expect(policy.onFailure()?.kind).toBe("retry");
    expect(policy.onFailure()?.kind).toBe("retry");
    const final = policy.onFailure();
    expect(final).toEqual({ kind: "give-up", attempt: 4 });
    expect(policy.state).toBe("stopped");
  });

  it("returns stopped decisions after stop()", () => {
    const policy = new QqbotReconnectPolicy();
    policy.stop();
    expect(policy.state).toBe("stopped");
    expect(policy.onFailure()).toEqual({ kind: "stopped" });
  });

  it("supports a custom backoff ladder", () => {
    const policy = new QqbotReconnectPolicy({ backoffMs: [100, 200] });
    expect(policy.delayForAttempt(1)).toBe(100);
    expect(policy.delayForAttempt(2)).toBe(200);
    expect(policy.delayForAttempt(9)).toBe(200);
  });
});
