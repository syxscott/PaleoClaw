/**
 * Declarative provider capability table.
 *
 * Historically provider behaviour was decided by hardcoded provider-name checks
 * scattered across the codebase (`CACHE_TTL_NATIVE_PROVIDERS`, the OpenRouter
 * model-id prefix list, the Kilocode special case, ...). This module turns
 * those decisions into data: one table describes, per provider, which protocol
 * it speaks, which cache mechanism it understands, whether long-lived cache
 * (TTL) is available and for which model ids, where its credential comes from
 * and whether its models are discovered by pi-ai or declared in the config.
 *
 * Design notes:
 * - The table mirrors the behaviour of the previous hardcoded logic **exactly**,
 *   with one deliberate exception: the MiniMax providers (`minimax`,
 *   `minimax-cn`) are cache-TTL eligible, because they are Anthropic-shaped
 *   endpoints that already receive `cache_control` from pi-ai.
 *   `provider-capabilities.test.ts` asserts that equivalence against the
 *   shipped `isCacheTtlEligibleProvider()` implementation, so the table can be
 *   adopted without a behaviour change.
 * - Provider ids are matched case-insensitively after trimming. Aliases are
 *   intentionally NOT resolved here: the hardcoded logic compared raw provider
 *   strings, so resolving aliases here would silently change behaviour.
 * - The credential is always referenced by environment variable name (the
 *   repo convention for `models.json`), never stored as a value.
 */

import fs from "node:fs";
import path from "node:path";
import { resolveOpenClawAgentDir } from "./agent-paths.js";
import { PROVIDER_ENV_API_KEY_CANDIDATES } from "./model-auth-env-vars.js";

/** Protocol spoken by a provider (transport level). */
export type ProviderApiProtocol =
  | "anthropic-messages"
  | "openai-completions"
  | "openai-responses"
  | "openai-codex-responses"
  | "azure-openai-responses"
  | "google-generative-ai"
  | "google-gemini-cli"
  | "google-vertex"
  | "mistral-conversations"
  | "bedrock-converse-stream"
  | "github-copilot"
  | "ollama";

/**
 * Shape used to express prompt caching.
 *
 * - `cache_control` — Anthropic shape (`cache_control` blocks). Also used by
 *   OpenAI-compatible gateways that proxy an Anthropic backend.
 * - `prompt_cache_key` — OpenAI shape (`prompt_cache_key` / `prompt_cache_retention`).
 * - `cached_content` — Google shape (cached content resources).
 * - `bedrock_cache_point` — Bedrock shape (`cachePoint`).
 * - `none` — provider does not support prompt caching.
 */
export type ProviderCacheMechanism =
  | "cache_control"
  | "prompt_cache_key"
  | "cached_content"
  | "bedrock_cache_point"
  | "none";

/** Where the models of a provider are discovered from. */
export type ProviderCatalogSource = "pi-native" | "config";

/** Authentication mode of a provider. */
export type ProviderAuthMode = "api-key" | "oauth" | "token" | "aws-sdk" | "none";

/** Modalities a model can accept. */
export type ModelInputType = "text" | "image" | "document";

/** Credential convention of a provider. */
export type ProviderCredentialConvention = {
  mode: ProviderAuthMode;
  /**
   * Environment variable names in priority order. The credential is persisted
   * as a reference to one of these names, never as the value itself.
   */
  envVars: readonly string[];
};

/** Long-lived cache (TTL) rule of a provider or model family. */
export type ProviderCacheTtlRule = {
  enabled: boolean;
  /**
   * When set, only model ids starting with one of these prefixes qualify.
   * When unset, every model of the provider qualifies.
   */
  modelPrefixes?: readonly string[];
};

/**
 * A model family of a provider: a set of model ids (matched by prefix and/or
 * by id fragment) that are served by a different backend than the provider
 * default — e.g. `anthropic/...` models served through an OpenAI-shaped
 * gateway.
 */
export type ProviderModelFamilyRule = {
  /** Stable family id, e.g. `anthropic`. */
  id: string;
  /** Lowercase model-id prefixes that select this family. */
  prefixes?: readonly string[];
  /** Lowercase model-id fragments that select this family. */
  includes?: readonly string[];
  /** Protocol spoken by the backend that actually serves these models. */
  upstreamApi?: ProviderApiProtocol;
  /** Cache mechanism these models understand. */
  cacheMechanism?: ProviderCacheMechanism;
  /** Cache TTL rule for these models. */
  cacheTtl?: ProviderCacheTtlRule;
  /** Modalities declared for these models. */
  input?: readonly ModelInputType[];
};

/** One row of the capability table. */
export type ProviderCapabilityEntry = {
  /** Normalized provider id (lowercase). */
  provider: string;
  /** Protocol spoken by the provider. */
  api: ProviderApiProtocol;
  /**
   * True when the provider speaks an OpenAI-shaped protocol. An Anthropic
   * backend behind such a provider must be addressed with the Anthropic cache
   * shape — sending the OpenAI shape yields a silent 0% cache hit.
   */
  openAiCompatible: boolean;
  credential: ProviderCredentialConvention;
  /** Cache mechanism used when no model family overrides it. */
  cacheMechanism: ProviderCacheMechanism;
  /** Long-lived cache rule. */
  cacheTtl: ProviderCacheTtlRule;
  /** Where the models of this provider come from. */
  catalogSource: ProviderCatalogSource;
  /** Modalities declared for the models of this provider. */
  input?: readonly ModelInputType[];
  /** Model families served by a different backend than the provider default. */
  families: readonly ProviderModelFamilyRule[];
};

/** Capability resolved for a concrete (provider, modelId) pair. */
export type ProviderCapability = {
  provider: string;
  /** Transport protocol. */
  api: ProviderApiProtocol;
  /** Protocol spoken by the backend that serves the model. */
  upstreamApi: ProviderApiProtocol;
  openAiCompatible: boolean;
  credential: ProviderCredentialConvention;
  cacheMechanism: ProviderCacheMechanism;
  /** True when long-lived cache (TTL) is available for this model. */
  cacheTtl: boolean;
  catalogSource: ProviderCatalogSource;
  /** Matched model family, if any. */
  family?: ProviderModelFamilyRule;
  /** Modalities declared for this model, if any. */
  input?: readonly ModelInputType[];
};

/** Provider ids that the repo special-cases. */
export const BEDROCK_PROVIDER_ID = "amazon-bedrock";
export const COPILOT_PROVIDER_ID = "github-copilot";
export const CODEX_PROVIDER_ID = "openai-codex";
export const OPENAI_PROVIDER_ID = "openai";
export const ANTHROPIC_PROVIDER_ID = "anthropic";

const DEFAULT_API: ProviderApiProtocol = "openai-completions";

function envVarsFor(provider: string): readonly string[] {
  return PROVIDER_ENV_API_KEY_CANDIDATES[provider] ?? [];
}

const ANTHROPIC_FAMILY: ProviderModelFamilyRule = {
  id: "anthropic",
  prefixes: ["anthropic/"],
  upstreamApi: "anthropic-messages",
  cacheMechanism: "cache_control",
  input: ["text", "image"],
};

const BEDROCK_ANTHROPIC_FAMILY: ProviderModelFamilyRule = {
  id: "anthropic",
  includes: ["anthropic.claude", "anthropic/claude"],
  input: ["text", "image"],
};

const TEXT_ONLY: readonly ModelInputType[] = ["text"];
const TEXT_AND_IMAGE: readonly ModelInputType[] = ["text", "image"];

/**
 * The built-in capability table.
 *
 * Every row mirrors the behaviour of the current hardcoded logic:
 * - `cacheTtl` reproduces `isCacheTtlEligibleProvider()`.
 * - `families` reproduces the Anthropic-model detection used for the
 *   OpenRouter system-prompt cache and for the Bedrock cache switch.
 */
const BUILTIN_PROVIDER_CAPABILITIES: readonly ProviderCapabilityEntry[] = [
  {
    provider: ANTHROPIC_PROVIDER_ID,
    api: "anthropic-messages",
    openAiCompatible: false,
    credential: { mode: "api-key", envVars: envVarsFor("anthropic") },
    cacheMechanism: "cache_control",
    cacheTtl: { enabled: true },
    catalogSource: "pi-native",
    input: TEXT_AND_IMAGE,
    families: [],
  },
  {
    provider: OPENAI_PROVIDER_ID,
    api: "openai-responses",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("openai") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    input: TEXT_AND_IMAGE,
    families: [],
  },
  {
    provider: CODEX_PROVIDER_ID,
    api: "openai-codex-responses",
    openAiCompatible: true,
    credential: { mode: "oauth", envVars: [] },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    input: TEXT_AND_IMAGE,
    families: [],
  },
  {
    provider: "azure-openai-responses",
    api: "azure-openai-responses",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: ["AZURE_OPENAI_API_KEY"] },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "google",
    api: "google-generative-ai",
    openAiCompatible: false,
    credential: { mode: "api-key", envVars: envVarsFor("google") },
    cacheMechanism: "cached_content",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    input: TEXT_AND_IMAGE,
    families: [],
  },
  {
    provider: "google-vertex",
    api: "google-vertex",
    openAiCompatible: false,
    credential: { mode: "oauth", envVars: [] },
    cacheMechanism: "cached_content",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    // Google Gemini CLI (Code Assist) — Google-shaped transport, OAuth login.
    provider: "google-gemini-cli",
    api: "google-gemini-cli",
    openAiCompatible: false,
    credential: { mode: "oauth", envVars: [] },
    cacheMechanism: "cached_content",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    // Google Antigravity — Google-shaped transport, OAuth login.
    provider: "google-antigravity",
    api: "google-gemini-cli",
    openAiCompatible: false,
    credential: { mode: "oauth", envVars: [] },
    cacheMechanism: "cached_content",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "github-copilot",
    api: "anthropic-messages",
    openAiCompatible: false,
    credential: { mode: "token", envVars: envVarsFor("github-copilot") },
    cacheMechanism: "cache_control",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    input: TEXT_AND_IMAGE,
    families: [],
  },
  {
    provider: BEDROCK_PROVIDER_ID,
    api: "bedrock-converse-stream",
    openAiCompatible: false,
    credential: {
      mode: "aws-sdk",
      envVars: ["AWS_BEARER_TOKEN_BEDROCK", "AWS_ACCESS_KEY_ID", "AWS_PROFILE"],
    },
    cacheMechanism: "bedrock_cache_point",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [BEDROCK_ANTHROPIC_FAMILY],
  },
  {
    // Z.AI speaks the OpenAI shape; pi-ai detects it by provider id.
    provider: "zai",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("zai") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: true },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "moonshot",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("moonshot") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: true },
    catalogSource: "pi-native",
    input: TEXT_AND_IMAGE,
    families: [],
  },
  {
    provider: "moonshotai",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: ["MOONSHOT_API_KEY"] },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "moonshotai-cn",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: ["MOONSHOT_API_KEY"] },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "openrouter",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("openrouter") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: {
      enabled: true,
      modelPrefixes: ["anthropic/", "moonshot/", "moonshotai/", "zai/"],
    },
    catalogSource: "pi-native",
    input: TEXT_AND_IMAGE,
    families: [ANTHROPIC_FAMILY],
  },
  {
    provider: "kilocode",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("kilocode") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: true, modelPrefixes: ["anthropic/"] },
    catalogSource: "config",
    input: TEXT_AND_IMAGE,
    families: [],
  },
  {
    // MiniMax serves an Anthropic-shaped endpoint (https://api.minimax.com/anthropic),
    // so pi-ai's Anthropic provider already emits `cache_control` for it. The
    // 5-minute ephemeral cache is the default there: pi-ai only widens it to
    // `ttl: "1h"` for api.anthropic.com, which MiniMax is not.
    provider: "minimax",
    api: "anthropic-messages",
    openAiCompatible: false,
    credential: { mode: "api-key", envVars: envVarsFor("minimax") },
    cacheMechanism: "cache_control",
    cacheTtl: { enabled: true },
    catalogSource: "pi-native",
    input: TEXT_AND_IMAGE,
    families: [],
  },
  {
    // MiniMax (China) — Anthropic-shaped endpoint, same cache behaviour as
    // `minimax`: `cache_control` blocks with the default 5m TTL.
    provider: "minimax-cn",
    api: "anthropic-messages",
    openAiCompatible: false,
    credential: { mode: "api-key", envVars: ["MINIMAX_API_KEY"] },
    cacheMechanism: "cache_control",
    cacheTtl: { enabled: true },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "minimax-portal",
    api: "anthropic-messages",
    openAiCompatible: false,
    credential: { mode: "oauth", envVars: envVarsFor("minimax-portal") },
    cacheMechanism: "cache_control",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    input: TEXT_AND_IMAGE,
    families: [],
  },
  {
    provider: "kimi-coding",
    api: "anthropic-messages",
    openAiCompatible: false,
    credential: { mode: "api-key", envVars: envVarsFor("kimi-coding") },
    cacheMechanism: "cache_control",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "synthetic",
    api: "anthropic-messages",
    openAiCompatible: false,
    credential: { mode: "api-key", envVars: envVarsFor("synthetic") },
    cacheMechanism: "cache_control",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "xiaomi",
    api: "anthropic-messages",
    openAiCompatible: false,
    credential: { mode: "api-key", envVars: envVarsFor("xiaomi") },
    cacheMechanism: "cache_control",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "cloudflare-ai-gateway",
    api: "anthropic-messages",
    openAiCompatible: false,
    credential: { mode: "api-key", envVars: envVarsFor("cloudflare-ai-gateway") },
    cacheMechanism: "cache_control",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "vercel-ai-gateway",
    api: "anthropic-messages",
    openAiCompatible: false,
    credential: { mode: "api-key", envVars: envVarsFor("vercel-ai-gateway") },
    cacheMechanism: "cache_control",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "fireworks",
    api: "anthropic-messages",
    openAiCompatible: false,
    credential: { mode: "api-key", envVars: ["FIREWORKS_API_KEY"] },
    cacheMechanism: "cache_control",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "qwen-portal",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "oauth", envVars: envVarsFor("qwen-portal") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    input: TEXT_AND_IMAGE,
    families: [],
  },
  {
    provider: "volcengine",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("volcengine") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "volcengine-plan",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("volcengine-plan") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "byteplus",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("byteplus") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "byteplus-plan",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("byteplus-plan") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "doubao",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("volcengine") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "qianfan",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("qianfan") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "nvidia",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("nvidia") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "together",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("together") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "huggingface",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("huggingface") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "venice",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("venice") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "vllm",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("vllm") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "ollama",
    api: "ollama",
    openAiCompatible: false,
    credential: { mode: "none", envVars: [] },
    cacheMechanism: "none",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "deepseek",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: ["DEEPSEEK_API_KEY"] },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "cerebras",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("cerebras") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "groq",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("groq") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "xai",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("xai") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "mistral",
    api: "mistral-conversations",
    openAiCompatible: false,
    credential: { mode: "api-key", envVars: envVarsFor("mistral") },
    cacheMechanism: "none",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "cloudflare-workers-ai",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: [] },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "opencode",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: envVarsFor("opencode") },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "opencode-go",
    api: "openai-completions",
    openAiCompatible: true,
    credential: { mode: "api-key", envVars: ["OPENCODE_API_KEY"] },
    cacheMechanism: "prompt_cache_key",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "xiaomi-token-plan-ams",
    api: "anthropic-messages",
    openAiCompatible: false,
    credential: { mode: "api-key", envVars: ["XIAOMI_API_KEY"] },
    cacheMechanism: "cache_control",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "xiaomi-token-plan-cn",
    api: "anthropic-messages",
    openAiCompatible: false,
    credential: { mode: "api-key", envVars: ["XIAOMI_API_KEY"] },
    cacheMechanism: "cache_control",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
  {
    provider: "xiaomi-token-plan-sgp",
    api: "anthropic-messages",
    openAiCompatible: false,
    credential: { mode: "api-key", envVars: ["XIAOMI_API_KEY"] },
    cacheMechanism: "cache_control",
    cacheTtl: { enabled: false },
    catalogSource: "pi-native",
    families: [],
  },
];

const BUILTIN_PROVIDER_CAPABILITY_MAP: ReadonlyMap<string, ProviderCapabilityEntry> = new Map(
  BUILTIN_PROVIDER_CAPABILITIES.map((entry) => [entry.provider, entry]),
);

function normalizeProviderKey(provider: string): string {
  return provider.trim().toLowerCase();
}

const API_CAPABILITY_DEFAULTS: Record<
  ProviderApiProtocol,
  { openAiCompatible: boolean; cacheMechanism: ProviderCacheMechanism }
> = {
  "anthropic-messages": { openAiCompatible: false, cacheMechanism: "cache_control" },
  "openai-completions": { openAiCompatible: true, cacheMechanism: "prompt_cache_key" },
  "openai-responses": { openAiCompatible: true, cacheMechanism: "prompt_cache_key" },
  "openai-codex-responses": { openAiCompatible: true, cacheMechanism: "prompt_cache_key" },
  "azure-openai-responses": { openAiCompatible: true, cacheMechanism: "prompt_cache_key" },
  "google-generative-ai": { openAiCompatible: false, cacheMechanism: "cached_content" },
  "google-gemini-cli": { openAiCompatible: false, cacheMechanism: "cached_content" },
  "google-vertex": { openAiCompatible: false, cacheMechanism: "cached_content" },
  "mistral-conversations": { openAiCompatible: false, cacheMechanism: "none" },
  "bedrock-converse-stream": { openAiCompatible: false, cacheMechanism: "bedrock_cache_point" },
  "github-copilot": { openAiCompatible: false, cacheMechanism: "none" },
  ollama: { openAiCompatible: false, cacheMechanism: "none" },
};

function deriveFromApi(api: ProviderApiProtocol): {
  openAiCompatible: boolean;
  cacheMechanism: ProviderCacheMechanism;
} {
  return API_CAPABILITY_DEFAULTS[api];
}

/* -------------------------------------------------------------------------- */
/* User-extensible overlay                                                     */
/* -------------------------------------------------------------------------- */

/** Name of the optional overlay file inside the agent directory. */
export const PROVIDER_CAPABILITIES_OVERRIDE_FILE = "provider-capabilities.json";

/** Partial provider row that an operator may declare. */
export type ProviderCapabilityOverride = {
  api?: ProviderApiProtocol;
  openAiCompatible?: boolean;
  credential?: Partial<ProviderCredentialConvention>;
  cacheMechanism?: ProviderCacheMechanism;
  cacheTtl?: ProviderCacheTtlRule;
  catalogSource?: ProviderCatalogSource;
  families?: readonly ProviderModelFamilyRule[];
};

/** Overlay: provider id -> partial row. */
export type ProviderCapabilityOverrides = {
  providers: Record<string, ProviderCapabilityOverride>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === "string");
}

function parseCacheTtlRule(value: unknown): ProviderCacheTtlRule | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const enabled = value.enabled;
  if (typeof enabled !== "boolean") {
    return undefined;
  }
  const modelPrefixes = asStringArray(value.modelPrefixes);
  return modelPrefixes && modelPrefixes.length > 0
    ? { enabled, modelPrefixes: modelPrefixes.map((prefix) => prefix.toLowerCase()) }
    : { enabled };
}

function parseFamilyRule(value: unknown): ProviderModelFamilyRule | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const id = value.id;
  if (typeof id !== "string" || !id.trim()) {
    return undefined;
  }
  const prefixes = asStringArray(value.prefixes)?.map((prefix) => prefix.toLowerCase());
  const includes = asStringArray(value.includes)?.map((fragment) => fragment.toLowerCase());
  const upstreamApi = value.upstreamApi;
  const cacheMechanism = value.cacheMechanism;
  const cacheTtl = parseCacheTtlRule(value.cacheTtl);
  const input = asStringArray(value.input)?.filter(
    (item): item is ModelInputType => item === "text" || item === "image" || item === "document",
  );
  return {
    id: id.trim(),
    ...(prefixes && prefixes.length > 0 ? { prefixes } : {}),
    ...(includes && includes.length > 0 ? { includes } : {}),
    ...(typeof upstreamApi === "string" ? { upstreamApi: upstreamApi as ProviderApiProtocol } : {}),
    ...(typeof cacheMechanism === "string"
      ? { cacheMechanism: cacheMechanism as ProviderCacheMechanism }
      : {}),
    ...(cacheTtl ? { cacheTtl } : {}),
    ...(input && input.length > 0 ? { input } : {}),
  };
}

function parseOverride(value: unknown): ProviderCapabilityOverride | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const credential = isRecord(value.credential) ? value.credential : undefined;
  const envVars = credential ? asStringArray(credential.envVars) : undefined;
  const credentialMode = credential?.mode;
  const families = Array.isArray(value.families)
    ? value.families
        .map((family) => parseFamilyRule(family))
        .filter((family): family is ProviderModelFamilyRule => family !== undefined)
    : undefined;
  const cacheTtl = parseCacheTtlRule(value.cacheTtl);
  return {
    ...(typeof value.api === "string" ? { api: value.api as ProviderApiProtocol } : {}),
    ...(typeof value.openAiCompatible === "boolean"
      ? { openAiCompatible: value.openAiCompatible }
      : {}),
    ...(credential
      ? {
          credential: {
            ...(typeof credentialMode === "string"
              ? { mode: credentialMode as ProviderAuthMode }
              : {}),
            ...(envVars ? { envVars } : {}),
          } as Partial<ProviderCredentialConvention>,
        }
      : {}),
    ...(typeof value.cacheMechanism === "string"
      ? { cacheMechanism: value.cacheMechanism as ProviderCacheMechanism }
      : {}),
    ...(cacheTtl ? { cacheTtl } : {}),
    ...(typeof value.catalogSource === "string"
      ? { catalogSource: value.catalogSource as ProviderCatalogSource }
      : {}),
    ...(families ? { families } : {}),
  };
}

/**
 * Parse the overlay document. Unknown or malformed entries are ignored so a
 * typo can never break provider resolution.
 */
export function parseProviderCapabilityOverrides(raw: unknown): ProviderCapabilityOverrides {
  if (!isRecord(raw)) {
    return { providers: {} };
  }
  const providersRaw = isRecord(raw.providers) ? raw.providers : undefined;
  if (!providersRaw) {
    return { providers: {} };
  }
  const providers: Record<string, ProviderCapabilityOverride> = {};
  for (const [key, value] of Object.entries(providersRaw)) {
    const provider = normalizeProviderKey(key);
    if (!provider) {
      continue;
    }
    const override = parseOverride(value);
    if (override) {
      providers[provider] = override;
    }
  }
  return { providers };
}

let overrideCache: { agentDir: string; overrides: ProviderCapabilityOverrides } | null = null;

/** Forget the cached overlay (test seam / explicit reload). */
export function resetProviderCapabilityOverrideCacheForTest(): void {
  overrideCache = null;
}

/**
 * Load the operator overlay from `<agentDir>/provider-capabilities.json`.
 *
 * The file is optional; a missing or malformed file yields an empty overlay.
 * The result is cached per agent directory for the process lifetime.
 */
export function loadProviderCapabilityOverrides(params?: {
  agentDir?: string;
}): ProviderCapabilityOverrides {
  let agentDir: string;
  try {
    agentDir = params?.agentDir?.trim() ? params.agentDir.trim() : resolveOpenClawAgentDir();
  } catch {
    return { providers: {} };
  }
  if (overrideCache?.agentDir === agentDir) {
    return overrideCache.overrides;
  }
  let overrides: ProviderCapabilityOverrides = { providers: {} };
  try {
    const file = path.join(agentDir, PROVIDER_CAPABILITIES_OVERRIDE_FILE);
    const raw = fs.readFileSync(file, "utf8");
    overrides = parseProviderCapabilityOverrides(JSON.parse(raw) as unknown);
  } catch {
    overrides = { providers: {} };
  }
  overrideCache = { agentDir, overrides };
  return overrides;
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

function mergeEntry(
  base: ProviderCapabilityEntry | undefined,
  override: ProviderCapabilityOverride | undefined,
  provider: string,
): ProviderCapabilityEntry | undefined {
  if (!base && !override) {
    return undefined;
  }
  const resolvedProvider = base?.provider ?? provider;
  const api = override?.api ?? base?.api ?? DEFAULT_API;
  const derived = deriveFromApi(api);
  const credential: ProviderCredentialConvention = {
    mode: override?.credential?.mode ?? base?.credential.mode ?? "api-key",
    envVars:
      override?.credential?.envVars ?? base?.credential.envVars ?? envVarsFor(resolvedProvider),
  };
  return {
    provider: resolvedProvider,
    api,
    openAiCompatible:
      override?.openAiCompatible ?? base?.openAiCompatible ?? derived.openAiCompatible,
    credential,
    cacheMechanism: override?.cacheMechanism ?? base?.cacheMechanism ?? derived.cacheMechanism,
    cacheTtl: override?.cacheTtl ?? base?.cacheTtl ?? { enabled: false },
    catalogSource: override?.catalogSource ?? base?.catalogSource ?? "pi-native",
    input: base?.input ?? TEXT_ONLY,
    families: override?.families ?? base?.families ?? [],
  };
}

function familyMatches(family: ProviderModelFamilyRule, modelId: string): boolean {
  const normalized = modelId.toLowerCase();
  if (family.prefixes?.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }
  if (family.includes?.some((fragment) => normalized.includes(fragment))) {
    return true;
  }
  return false;
}

/** Find the model family rule that matches the given model id, if any. */
export function resolveProviderModelFamily(
  entry: ProviderCapabilityEntry | undefined,
  modelId: string | undefined,
): ProviderModelFamilyRule | undefined {
  if (!entry || !modelId) {
    return undefined;
  }
  return entry.families.find((family) => familyMatches(family, modelId));
}

/**
 * Look up the capability row of a provider (built-in table merged with the
 * operator overlay).
 */
export function getProviderCapabilityEntry(
  provider: string,
  overrides?: ProviderCapabilityOverrides,
): ProviderCapabilityEntry | undefined {
  const key = normalizeProviderKey(provider);
  if (!key) {
    return undefined;
  }
  const overlay = overrides ?? loadProviderCapabilityOverrides();
  return mergeEntry(BUILTIN_PROVIDER_CAPABILITY_MAP.get(key), overlay.providers[key], key);
}

/** List all built-in provider rows. */
export function listProviderCapabilityEntries(): readonly ProviderCapabilityEntry[] {
  return BUILTIN_PROVIDER_CAPABILITIES;
}

/**
 * Resolve the capability of a (provider, modelId) pair.
 *
 * `api` may be supplied by the caller (e.g. from `models.json` or the pi-ai
 * model registry) and takes precedence over the table default.
 */
export function resolveProviderCapability(params: {
  provider: string;
  modelId?: string;
  api?: string;
  overrides?: ProviderCapabilityOverrides;
}): ProviderCapability {
  const provider = normalizeProviderKey(params.provider);
  const entry = getProviderCapabilityEntry(provider, params.overrides);
  const explicitApi = params.api?.trim();
  const api = (explicitApi || entry?.api || DEFAULT_API) as ProviderApiProtocol;
  const derived = deriveFromApi(api);
  const family = resolveProviderModelFamily(entry, params.modelId);
  const ttlRule = family?.cacheTtl ?? entry?.cacheTtl ?? { enabled: false };
  const modelId = params.modelId?.trim();

  return {
    provider,
    api,
    upstreamApi: family?.upstreamApi ?? api,
    openAiCompatible: entry?.openAiCompatible ?? derived.openAiCompatible,
    credential: entry?.credential ?? { mode: "api-key", envVars: envVarsFor(provider) },
    cacheMechanism:
      family?.cacheMechanism ??
      (explicitApi ? derived.cacheMechanism : (entry?.cacheMechanism ?? derived.cacheMechanism)),
    cacheTtl: resolveCacheTtl({ rule: ttlRule, modelId }),
    catalogSource: entry?.catalogSource ?? "pi-native",
    ...(family ? { family } : {}),
    input: family?.input ?? entry?.input,
  };
}

function resolveCacheTtl(params: { rule: ProviderCacheTtlRule; modelId?: string }): boolean {
  if (!params.rule.enabled) {
    return false;
  }
  const prefixes = params.rule.modelPrefixes;
  if (!prefixes || prefixes.length === 0) {
    return true;
  }
  if (!params.modelId) {
    return false;
  }
  const normalized = params.modelId.toLowerCase();
  return prefixes.some((prefix) => normalized.startsWith(prefix));
}

/** Protocol spoken by a provider (transport level). */
export function resolveProviderApiProtocol(params: {
  provider: string;
  modelId?: string;
  api?: string;
  overrides?: ProviderCapabilityOverrides;
}): ProviderApiProtocol {
  return resolveProviderCapability(params).api;
}

/** Cache mechanism used for a (provider, modelId) pair. */
export function resolveProviderCacheMechanism(params: {
  provider: string;
  modelId?: string;
  api?: string;
  overrides?: ProviderCapabilityOverrides;
}): ProviderCacheMechanism {
  return resolveProviderCapability(params).cacheMechanism;
}

/**
 * Whether long-lived cache (TTL) is available for a (provider, modelId) pair.
 *
 * This is the declarative replacement of the hardcoded
 * `isCacheTtlEligibleProvider()` check.
 */
export function supportsProviderCacheTtl(params: {
  provider: string;
  modelId?: string;
  overrides?: ProviderCapabilityOverrides;
}): boolean {
  return resolveProviderCapability(params).cacheTtl;
}

/** Whether the provider speaks an OpenAI-shaped protocol. */
export function isOpenAiCompatibleProvider(
  provider: string,
  overrides?: ProviderCapabilityOverrides,
): boolean {
  return getProviderCapabilityEntry(provider, overrides)?.openAiCompatible ?? false;
}

/**
 * Whether a transport protocol speaks the OpenAI request shape.
 *
 * The OpenAI `prompt_cache_key` field only exists in an OpenAI-shaped body.
 * Sending it to an Anthropic-shaped protocol is not merely useless — the
 * backend ignores it and the prefix cache never hits (opencode #25984 /
 * #26460), and some gateways reject the unknown field outright.
 */
export function isOpenAiShapedApi(api: string | undefined): boolean {
  if (!api) {
    return false;
  }
  return API_CAPABILITY_DEFAULTS[api as ProviderApiProtocol]?.openAiCompatible ?? false;
}

/** Credential convention (auth mode + env var references) of a provider. */
export function resolveProviderCredentialConvention(
  provider: string,
  overrides?: ProviderCapabilityOverrides,
): ProviderCredentialConvention {
  return (
    getProviderCapabilityEntry(provider, overrides)?.credential ?? {
      mode: "api-key",
      envVars: envVarsFor(normalizeProviderKey(provider)),
    }
  );
}

/**
 * The canonical environment variable name a provider's credential is
 * referenced by (the repo convention for `models.json`).
 */
export function resolveProviderCredentialEnvVar(
  provider: string,
  overrides?: ProviderCapabilityOverrides,
): string | undefined {
  return resolveProviderCredentialConvention(provider, overrides).envVars[0];
}

/**
 * Whether the models of a provider have to be declared in the operator config
 * (instead of being discovered from the pi-ai model registry).
 */
export function requiresConfigDeclaredModels(
  provider: string,
  overrides?: ProviderCapabilityOverrides,
): boolean {
  return getProviderCapabilityEntry(provider, overrides)?.catalogSource === "config";
}
