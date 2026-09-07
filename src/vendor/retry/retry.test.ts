import { describe, expect, it } from "vitest";
import { computeBackoff, retryAsync, sleepWithAbort } from "./index.js";

describe("computeBackoff", () => {
  it("grows exponentially with the attempt number", () => {
    const policy = { initialMs: 100, maxMs: 10_000, factor: 2, jitter: 0 };
    expect(computeBackoff(policy, 1)).toBe(100);
    expect(computeBackoff(policy, 2)).toBe(200);
    expect(computeBackoff(policy, 3)).toBe(400);
    expect(computeBackoff(policy, 0)).toBe(100);
  });

  it("keeps positive jitter within [base, base * (1 + jitter)]", () => {
    const policy = { initialMs: 200, maxMs: 10_000, factor: 2, jitter: 0.5 };
    for (let index = 0; index < 50; index += 1) {
      // Attempt 2 has a base delay of 400ms; jitter 0.5 allows 400..600.
      const delay = computeBackoff(policy, 2);
      expect(delay).toBeGreaterThanOrEqual(400);
      expect(delay).toBeLessThanOrEqual(600);
    }
  });

  it("caps the delay at maxMs", () => {
    const policy = { initialMs: 1_000, maxMs: 500, factor: 3, jitter: 1 };
    expect(computeBackoff(policy, 5)).toBe(500);
    expect(computeBackoff(policy, 1)).toBe(500);
  });
});

describe("sleepWithAbort", () => {
  it("resolves after the requested delay", async () => {
    await expect(sleepWithAbort(1)).resolves.toBeUndefined();
  });

  it("rejects with an AbortError when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(sleepWithAbort(10, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("rejects with an AbortError when aborted mid-sleep", async () => {
    const controller = new AbortController();
    const pending = sleepWithAbort(1_000, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("retryAsync", () => {
  it("retries transient failures with exponential backoff and throws the last error", async () => {
    let calls = 0;
    const sleeps: number[] = [];
    const failure = Object.assign(new Error("upstream unavailable"), { status: 503 });
    await expect(
      retryAsync(
        async () => {
          calls += 1;
          throw failure;
        },
        {
          attempts: 3,
          minDelayMs: 100,
          maxDelayMs: 1_000,
          jitter: 0,
          shouldRetry: (error) => (error as { status?: number }).status === 503,
          sleep: async (ms) => {
            sleeps.push(ms);
          },
        },
      ),
    ).rejects.toBe(failure);
    expect(calls).toBe(3);
    expect(sleeps).toEqual([100, 200]);
  });

  it("does not retry non-retryable 4xx failures", async () => {
    let calls = 0;
    const failure = Object.assign(new Error("bad request"), { status: 400 });
    await expect(
      retryAsync(
        async () => {
          calls += 1;
          throw failure;
        },
        {
          attempts: 3,
          shouldRetry: (error) => (error as { status?: number }).status === 429,
          sleep: async () => {},
        },
      ),
    ).rejects.toBe(failure);
    expect(calls).toBe(1);
  });

  it("returns the successful result once a retry succeeds", async () => {
    let calls = 0;
    const result = await retryAsync(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw Object.assign(new Error("throttled"), { status: 429 });
        }
        return "ok";
      },
      { attempts: 3, minDelayMs: 10, jitter: 0, sleep: async () => {} },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });
});
