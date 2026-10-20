import type { StreamFn } from "@mariozechner/pi-agent-core";
import { createAssistantMessageEventStream, type Context, type Model } from "@mariozechner/pi-ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createStreamWatchdogWrapper,
  resolveStreamWatchdogConfig,
  type StreamWatchdogLog,
} from "./stream-watchdog.js";

const model: Model<"anthropic-messages"> = {
  id: "claude-x",
  name: "claude-x",
  api: "anthropic-messages",
  provider: "anthropic",
  baseUrl: "https://api.anthropic.com",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 200_000,
  maxTokens: 8_192,
};

const context: Context = { systemPrompt: "system", messages: [] };

function assistantMessage(text: string) {
  return {
    role: "assistant" as const,
    content: [{ type: "text" as const, text }],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop" as const,
    timestamp: Date.now(),
  };
}

const ENV = {
  OPENCLAW_STREAM_WATCHDOG: "1",
  OPENCLAW_STREAM_WATCHDOG_IDLE_TIMEOUT_MS: "1000",
  OPENCLAW_STREAM_WATCHDOG_STALL_TIMEOUT_MS: "500",
};

describe("resolveStreamWatchdogConfig", () => {
  it("is disabled by default", () => {
    const config = resolveStreamWatchdogConfig({ env: {} });

    expect(config.enabled).toBe(false);
  });

  it("enables when a timeout is configured explicitly", () => {
    const config = resolveStreamWatchdogConfig({
      env: { OPENCLAW_STREAM_WATCHDOG_IDLE_TIMEOUT_MS: "1234" },
    });

    expect(config.enabled).toBe(true);
    expect(config.idleTimeoutMs).toBe(1234);
  });

  it("can be disabled explicitly even when timeouts are set", () => {
    const config = resolveStreamWatchdogConfig({
      env: { OPENCLAW_STREAM_WATCHDOG: "0", OPENCLAW_STREAM_WATCHDOG_IDLE_TIMEOUT_MS: "1234" },
    });

    expect(config.enabled).toBe(false);
  });

  it("derives the idle timeout from the run timeout and the profile", () => {
    const fresh = resolveStreamWatchdogConfig({
      env: { OPENCLAW_STREAM_WATCHDOG: "1" },
      runTimeoutMs: 300_000,
      profile: "fresh",
    });
    const resume = resolveStreamWatchdogConfig({
      env: { OPENCLAW_STREAM_WATCHDOG: "1" },
      runTimeoutMs: 300_000,
      profile: "resume",
    });

    expect(fresh.idleTimeoutMs).toBe(240_000);
    expect(resume.idleTimeoutMs).toBe(90_000);
  });
});

describe("createStreamWatchdogWrapper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("interrupts an idle stream and falls back to a non-streaming request", async () => {
    const events = createAssistantMessageEventStream();
    let seenSignal: AbortSignal | undefined;
    const streamFn: StreamFn = (_model, _context, options) => {
      seenSignal = options?.signal;
      return events;
    };
    const fallback = vi.fn(async () => assistantMessage("fallback answer"));
    const logs: Array<{ level: string; message: string }> = [];
    const log: StreamWatchdogLog = (level, message) => {
      logs.push({ level, message });
    };

    const wrapped = createStreamWatchdogWrapper({ env: ENV, fallback, log })(streamFn);
    const stream = wrapped(model, context, {});

    await vi.advanceTimersByTimeAsync(1_100);

    expect(fallback).toHaveBeenCalledTimes(1);
    expect(seenSignal?.aborted).toBe(true);
    const message = await (await stream).result();
    expect(message.content).toEqual([{ type: "text", text: "fallback answer" }]);
    expect(logs.some((entry) => entry.message.includes("idle watchdog fired"))).toBe(true);
  });

  it("warns before the idle threshold elapses", async () => {
    const events = createAssistantMessageEventStream();
    const streamFn: StreamFn = () => events;
    const fallback = vi.fn(async () => assistantMessage("fallback"));
    const logs: string[] = [];

    const wrapped = createStreamWatchdogWrapper({
      env: ENV,
      fallback,
      log: (_level, message) => logs.push(message),
    })(streamFn);
    void wrapped(model, context, {});

    await vi.advanceTimersByTimeAsync(600);

    expect(logs.some((entry) => entry.includes("idle watchdog warning"))).toBe(true);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("does not interrupt a slow but alive stream, it only logs the stall", async () => {
    const events = createAssistantMessageEventStream();
    let seenSignal: AbortSignal | undefined;
    const streamFn: StreamFn = (_model, _context, options) => {
      seenSignal = options?.signal;
      return events;
    };
    const fallback = vi.fn(async () => assistantMessage("fallback"));
    const logs: string[] = [];

    const wrapped = createStreamWatchdogWrapper({
      env: ENV,
      fallback,
      log: (_level, message) => logs.push(message),
    })(streamFn);
    const stream = wrapped(model, context, {});

    const partial = assistantMessage("partial");
    events.push({ type: "text_delta", contentIndex: 0, delta: "par", partial });
    await vi.advanceTimersByTimeAsync(900);

    expect(fallback).not.toHaveBeenCalled();
    expect(seenSignal?.aborted).toBe(false);
    expect(logs.some((entry) => entry.includes("stall detected"))).toBe(true);

    const final = assistantMessage("done");
    events.push({ type: "done", reason: "stop", message: final });
    const message = await (await stream).result();
    expect(message.content).toEqual([{ type: "text", text: "done" }]);
  });

  it("leaves a healthy stream untouched", async () => {
    const events = createAssistantMessageEventStream();
    const streamFn: StreamFn = () => events;
    const fallback = vi.fn(async () => assistantMessage("fallback"));

    const wrapped = createStreamWatchdogWrapper({ env: ENV, fallback })(streamFn);
    const stream = wrapped(model, context, {});

    const partial = assistantMessage("hello");
    events.push({ type: "text_delta", contentIndex: 0, delta: "hel", partial });
    await vi.advanceTimersByTimeAsync(100);
    const final = assistantMessage("hello world");
    events.push({ type: "done", reason: "stop", message: final });

    const message = await (await stream).result();
    expect(message.content).toEqual([{ type: "text", text: "hello world" }]);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("behaves exactly as today when the watchdog is not configured", () => {
    const events = createAssistantMessageEventStream();
    let seenOptions: unknown;
    const streamFn: StreamFn = (_model, _context, options) => {
      seenOptions = options;
      return events;
    };
    const fallback = vi.fn(async () => assistantMessage("fallback"));

    const wrapped = createStreamWatchdogWrapper({ env: {}, fallback })(streamFn);
    const stream = wrapped(model, context, { temperature: 0.2 });

    expect(stream).toBe(events);
    expect(seenOptions).toEqual({ temperature: 0.2 });
    expect(fallback).not.toHaveBeenCalled();
  });
});
