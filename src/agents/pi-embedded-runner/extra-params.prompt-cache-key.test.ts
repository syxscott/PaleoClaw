import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { Api, Context, Model } from "@mariozechner/pi-ai";
import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { applyExtraParamsToAgent } from "./extra-params.js";

/**
 * Run one payload through the extra-params wrappers and return the payload
 * the provider would have received.
 */
function runPayload(params: {
  provider: string;
  modelId: string;
  api: Api;
  payload: Record<string, unknown>;
  sessionId?: string;
}): Record<string, unknown> {
  const baseStreamFn: StreamFn = (model, _context, options) => {
    options?.onPayload?.(params.payload, model);
    return createAssistantMessageEventStream();
  };
  const agent = { streamFn: baseStreamFn };

  applyExtraParamsToAgent(agent, undefined, params.provider, params.modelId);

  const model = {
    api: params.api,
    provider: params.provider,
    id: params.modelId,
  } as Model<Api>;
  const context: Context = { messages: [] };

  void agent.streamFn?.(model, context, params.sessionId ? { sessionId: params.sessionId } : {});
  return params.payload;
}

describe("extra-params: prompt_cache_key", () => {
  it("adds the session id as prompt_cache_key for an OpenAI-compatible provider", () => {
    const payload = runPayload({
      provider: "moonshot",
      modelId: "kimi-k2.5",
      api: "openai-completions",
      payload: { model: "kimi-k2.5", messages: [], stream: true },
      sessionId: "session-abc",
    });

    expect(payload.prompt_cache_key).toBe("session-abc");
  });

  it("adds the session id for an unknown OpenAI-shaped provider", () => {
    const payload = runPayload({
      provider: "my-self-hosted-gateway",
      modelId: "some-model",
      api: "openai-completions",
      payload: { model: "some-model", messages: [], stream: true },
      sessionId: "session-abc",
    });

    expect(payload.prompt_cache_key).toBe("session-abc");
  });

  it("does not add prompt_cache_key for an Anthropic-shaped provider", () => {
    const payload = runPayload({
      provider: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      api: "anthropic-messages",
      payload: { model: "claude-sonnet-4-20250514", messages: [], stream: true },
      sessionId: "session-abc",
    });

    expect(payload).not.toHaveProperty("prompt_cache_key");
  });

  it("does not add prompt_cache_key for an Anthropic-shaped MiniMax provider", () => {
    const payload = runPayload({
      provider: "minimax-cn",
      modelId: "MiniMax-M2.5",
      api: "anthropic-messages",
      payload: { model: "MiniMax-M2.5", messages: [], stream: true },
      sessionId: "session-abc",
    });

    expect(payload).not.toHaveProperty("prompt_cache_key");
  });

  it("does not add prompt_cache_key for an Anthropic model behind an OpenAI-shaped gateway", () => {
    const payload = runPayload({
      provider: "openrouter",
      modelId: "anthropic/claude-opus-4-6",
      api: "openai-completions",
      payload: { model: "anthropic/claude-opus-4-6", messages: [], stream: true },
      sessionId: "session-abc",
    });

    expect(payload).not.toHaveProperty("prompt_cache_key");
  });

  it("never overwrites a prompt_cache_key that pi-ai already set", () => {
    const payload = runPayload({
      provider: "moonshot",
      modelId: "kimi-k2.5",
      api: "openai-completions",
      payload: {
        model: "kimi-k2.5",
        messages: [],
        stream: true,
        prompt_cache_key: "key-from-pi-ai",
      },
      sessionId: "session-abc",
    });

    expect(payload.prompt_cache_key).toBe("key-from-pi-ai");
  });

  it("does not set prompt_cache_key without a session id", () => {
    const payload = runPayload({
      provider: "moonshot",
      modelId: "kimi-k2.5",
      api: "openai-completions",
      payload: { model: "kimi-k2.5", messages: [], stream: true },
    });

    expect(payload).not.toHaveProperty("prompt_cache_key");
  });

  it("does not set prompt_cache_key for a blank session id", () => {
    const payload = runPayload({
      provider: "moonshot",
      modelId: "kimi-k2.5",
      api: "openai-completions",
      payload: { model: "kimi-k2.5", messages: [], stream: true },
      sessionId: "   ",
    });

    expect(payload).not.toHaveProperty("prompt_cache_key");
  });
});
