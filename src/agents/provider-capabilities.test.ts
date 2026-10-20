import { getModels, getProviders } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { isCacheTtlEligibleProvider } from "./pi-embedded-runner/cache-ttl.js";
import {
  getProviderCapabilityEntry,
  listProviderCapabilityEntries,
  parseProviderCapabilityOverrides,
  requiresConfigDeclaredModels,
  resolveProviderCacheMechanism,
  resolveProviderCapability,
  resolveProviderCredentialConvention,
  resolveProviderCredentialEnvVar,
  supportsProviderCacheTtl,
} from "./provider-capabilities.js";

/**
 * Local copy of the hardcoded logic that the capability table replaces.
 * Kept in the test on purpose: it is the behaviour the table has to match.
 */
function currentAnthropicFamily(provider: string, modelId: string): boolean {
  const normalizedProvider = provider.toLowerCase();
  const normalizedModelId = modelId.toLowerCase();
  if (normalizedProvider === "openrouter" && normalizedModelId.startsWith("anthropic/")) {
    return true;
  }
  if (
    normalizedProvider === "amazon-bedrock" &&
    (normalizedModelId.includes("anthropic.claude") ||
      normalizedModelId.includes("anthropic/claude"))
  ) {
    return true;
  }
  return false;
}

const CACHE_TTL_CASES: ReadonlyArray<readonly [string, string]> = [
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
  ["minimax", "MiniMax-M2.5"],
  ["kimi-coding", "k2p5"],
  ["custom-gateway", "some-model"],
];

const ANTHROPIC_FAMILY_CASES: ReadonlyArray<readonly [string, string]> = [
  ["openrouter", "anthropic/claude-sonnet-4"],
  ["openrouter", "openai/gpt-4o"],
  ["openrouter", "auto"],
  ["amazon-bedrock", "anthropic.claude-3-5-sonnet-20241022-v2:0"],
  ["amazon-bedrock", "anthropic/claude-3-5-sonnet"],
  ["amazon-bedrock", "amazon.nova-pro-v1:0"],
  ["kilocode", "anthropic/claude-opus-4.6"],
  ["anthropic", "claude-sonnet-4"],
];

describe("provider capability table", () => {
  it("matches the current hardcoded cache-TTL logic for every representative pair", () => {
    for (const [provider, modelId] of CACHE_TTL_CASES) {
      expect(
        supportsProviderCacheTtl({ provider, modelId }),
        `cache TTL mismatch for ${provider}/${modelId}`,
      ).toBe(isCacheTtlEligibleProvider(provider, modelId));
    }
  });

  it("matches the current hardcoded Anthropic-model detection", () => {
    for (const [provider, modelId] of ANTHROPIC_FAMILY_CASES) {
      const capability = resolveProviderCapability({ provider, modelId });
      expect(
        capability.family?.id === "anthropic",
        `family mismatch for ${provider}/${modelId}`,
      ).toBe(currentAnthropicFamily(provider, modelId));
    }
  });

  it("covers every pi-ai built-in provider with a matching protocol", () => {
    for (const provider of getProviders()) {
      const entry = getProviderCapabilityEntry(provider);
      expect(entry, `missing capability row for ${provider}`).toBeDefined();
      const apis = new Set<string>(getModels(provider).map((model) => String(model.api)));
      expect(
        apis.has(entry?.api ?? ""),
        `protocol mismatch for ${provider}: table=${entry?.api} catalog=${[...apis].join(",")}`,
      ).toBe(true);
    }
  });

  it("exposes the protocol, cache mechanism and OpenAI compatibility per provider", () => {
    expect(resolveProviderCapability({ provider: "anthropic" }).api).toBe("anthropic-messages");
    expect(resolveProviderCapability({ provider: "anthropic" }).cacheMechanism).toBe(
      "cache_control",
    );
    expect(resolveProviderCapability({ provider: "openai" }).api).toBe("openai-responses");
    expect(resolveProviderCapability({ provider: "openai" }).cacheMechanism).toBe(
      "prompt_cache_key",
    );
    expect(resolveProviderCapability({ provider: "google" }).cacheMechanism).toBe("cached_content");
    expect(resolveProviderCapability({ provider: "openrouter" }).openAiCompatible).toBe(true);
    expect(resolveProviderCapability({ provider: "anthropic" }).openAiCompatible).toBe(false);
  });

  it("uses the Anthropic cache shape for Anthropic models behind an OpenAI-shaped gateway", () => {
    const capability = resolveProviderCapability({
      provider: "openrouter",
      modelId: "anthropic/claude-sonnet-4",
    });
    expect(capability.api).toBe("openai-completions");
    expect(capability.upstreamApi).toBe("anthropic-messages");
    expect(capability.cacheMechanism).toBe("cache_control");
    expect(
      resolveProviderCacheMechanism({ provider: "openrouter", modelId: "openai/gpt-4o" }),
    ).toBe("prompt_cache_key");
  });

  it("keeps the credential as an env-var reference", () => {
    expect(resolveProviderCredentialEnvVar("openai")).toBe("OPENAI_API_KEY");
    expect(resolveProviderCredentialEnvVar("anthropic")).toBe("ANTHROPIC_OAUTH_TOKEN");
    expect(resolveProviderCredentialConvention("amazon-bedrock").mode).toBe("aws-sdk");
    expect(resolveProviderCredentialConvention("amazon-bedrock").envVars).toContain("AWS_PROFILE");
  });

  it("marks providers whose models have to be declared in the config", () => {
    expect(requiresConfigDeclaredModels("kilocode")).toBe(true);
    expect(requiresConfigDeclaredModels("openai")).toBe(false);
    expect(requiresConfigDeclaredModels("unknown-provider")).toBe(false);
  });

  it("falls back to sane defaults for unknown providers", () => {
    const capability = resolveProviderCapability({ provider: "my-gateway" });
    expect(capability.api).toBe("openai-completions");
    expect(capability.openAiCompatible).toBe(true);
    expect(capability.cacheMechanism).toBe("prompt_cache_key");
    expect(capability.cacheTtl).toBe(false);
  });

  it("honours an explicit api over the table default", () => {
    const capability = resolveProviderCapability({
      provider: "github-copilot",
      api: "openai-responses",
    });
    expect(capability.api).toBe("openai-responses");
    expect(capability.cacheMechanism).toBe("prompt_cache_key");
  });

  it("lets an operator declare a self-hosted provider without a code change", () => {
    const overrides = parseProviderCapabilityOverrides({
      providers: {
        "my-gateway": {
          api: "anthropic-messages",
          openAiCompatible: false,
          credential: { mode: "api-key", envVars: ["GATEWAY_API_KEY"] },
          cacheMechanism: "cache_control",
          cacheTtl: { enabled: true },
          catalogSource: "config",
        },
      },
    });

    const capability = resolveProviderCapability({
      provider: "my-gateway",
      modelId: "my-model",
      overrides,
    });
    expect(capability.api).toBe("anthropic-messages");
    expect(capability.openAiCompatible).toBe(false);
    expect(capability.cacheMechanism).toBe("cache_control");
    expect(capability.cacheTtl).toBe(true);
    expect(capability.credential.envVars).toEqual(["GATEWAY_API_KEY"]);
    expect(requiresConfigDeclaredModels("my-gateway", overrides)).toBe(true);
  });

  it("ignores malformed overlay entries instead of breaking resolution", () => {
    const overrides = parseProviderCapabilityOverrides({
      providers: {
        broken: { api: 42 },
        "": { api: "openai-completions" },
      },
    });
    expect(Object.keys(overrides.providers)).toEqual(["broken"]);
    expect(() => resolveProviderCapability({ provider: "broken", overrides })).not.toThrow();
  });

  it("keeps every built-in row normalized and complete", () => {
    for (const entry of listProviderCapabilityEntries()) {
      expect(entry.provider).toBe(entry.provider.trim().toLowerCase());
      expect(entry.api).toBeTruthy();
      expect(entry.credential.envVars.length).toBeGreaterThanOrEqual(0);
    }
  });
});
