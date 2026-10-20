import { describe, expect, it } from "vitest";
import { isCacheTtlEligibleProvider } from "./cache-ttl.js";

/**
 * Copy of the hardcoded provider lists this module used before it was
 * rewired onto the declarative capability table. It is the behaviour the
 * delegation has to reproduce byte-for-byte.
 */
function legacyCacheTtlEligible(provider: string, modelId: string): boolean {
  const nativeProviders = new Set(["anthropic", "moonshot", "zai"]);
  const openRouterPrefixes = ["anthropic/", "moonshot/", "moonshotai/", "zai/"];
  const normalizedProvider = provider.toLowerCase();
  const normalizedModelId = modelId.toLowerCase();
  if (nativeProviders.has(normalizedProvider)) {
    return true;
  }
  if (
    normalizedProvider === "openrouter" &&
    openRouterPrefixes.some((prefix) => normalizedModelId.startsWith(prefix))
  ) {
    return true;
  }
  if (normalizedProvider === "kilocode" && normalizedModelId.startsWith("anthropic/")) {
    return true;
  }
  return false;
}

const DELEGATION_CASES: ReadonlyArray<readonly [string, string]> = [
  ["anthropic", "claude-sonnet-4-20250514"],
  ["Anthropic", "Claude-Sonnet-4"],
  ["moonshot", "kimi-k2.5"],
  ["Moonshot", "Kimi-K2.5"],
  ["zai", "glm-5"],
  ["ZAI", "GLM-5"],
  ["openrouter", "anthropic/claude-sonnet-4"],
  ["openrouter", "moonshotai/kimi-k2.5"],
  ["openrouter", "moonshot/kimi-k2.5"],
  ["openrouter", "zai/glm-5"],
  ["openrouter", "openai/gpt-4o"],
  ["openrouter", "auto"],
  ["kilocode", "anthropic/claude-opus-4.6"],
  ["kilocode", "openai/gpt-5"],
  ["Kilocode", "Anthropic/claude-opus-4.6"],
  ["openai", "gpt-4o"],
  ["openai-codex", "gpt-5.4"],
  ["amazon-bedrock", "anthropic.claude-3-5-sonnet"],
  ["moonshotai", "kimi-k2.5"],
  ["z-ai", "glm-5"],
  ["qianfan", "deepseek-v3.2"],
  ["kimi-coding", "k2p5"],
  ["custom-gateway", "some-model"],
];

describe("isCacheTtlEligibleProvider", () => {
  it("allows anthropic", () => {
    expect(isCacheTtlEligibleProvider("anthropic", "claude-sonnet-4-20250514")).toBe(true);
  });

  it("allows moonshot and zai providers", () => {
    expect(isCacheTtlEligibleProvider("moonshot", "kimi-k2.5")).toBe(true);
    expect(isCacheTtlEligibleProvider("zai", "glm-5")).toBe(true);
  });

  it("is case-insensitive for native providers", () => {
    expect(isCacheTtlEligibleProvider("Moonshot", "Kimi-K2.5")).toBe(true);
    expect(isCacheTtlEligibleProvider("ZAI", "GLM-5")).toBe(true);
  });

  it("allows openrouter cache-ttl models", () => {
    expect(isCacheTtlEligibleProvider("openrouter", "anthropic/claude-sonnet-4")).toBe(true);
    expect(isCacheTtlEligibleProvider("openrouter", "moonshotai/kimi-k2.5")).toBe(true);
    expect(isCacheTtlEligibleProvider("openrouter", "moonshot/kimi-k2.5")).toBe(true);
    expect(isCacheTtlEligibleProvider("openrouter", "zai/glm-5")).toBe(true);
  });

  it("rejects unsupported providers and models", () => {
    expect(isCacheTtlEligibleProvider("openai", "gpt-4o")).toBe(false);
    expect(isCacheTtlEligibleProvider("openrouter", "openai/gpt-4o")).toBe(false);
  });

  it("delegates to the capability table and keeps the previous answers", () => {
    for (const [provider, modelId] of DELEGATION_CASES) {
      expect(
        isCacheTtlEligibleProvider(provider, modelId),
        `cache TTL mismatch for ${provider}/${modelId}`,
      ).toBe(legacyCacheTtlEligible(provider, modelId));
    }
  });

  it("allows the MiniMax providers (Anthropic-shaped, cache_control)", () => {
    expect(isCacheTtlEligibleProvider("minimax", "MiniMax-M2.5")).toBe(true);
    expect(isCacheTtlEligibleProvider("minimax-cn", "MiniMax-M2.5")).toBe(true);
  });
});
