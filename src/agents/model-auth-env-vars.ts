import type { ProviderAuthEvidence } from "../secrets/provider-env-vars.js";

export { resolveProviderAuthLookupMaps as resolveProviderEnvAuthLookupMaps } from "../secrets/provider-env-vars.js";

/** Lists every provider key represented by either env candidates or auth evidence. */
export function listProviderEnvAuthLookupKeys(params: {
  envCandidateMap: Readonly<Record<string, readonly string[]>>;
  authEvidenceMap: Readonly<Record<string, readonly ProviderAuthEvidence[]>>;
}): string[] {
  // Evidence-only providers still need status/discovery rows even when they do not expose env vars.
  return Array.from(
    new Set([...Object.keys(params.envCandidateMap), ...Object.keys(params.authEvidenceMap)]),
  ).toSorted((a, b) => a.localeCompare(b));
}

// --- PaleoClaw 兼容层：PROVIDER_ENV_API_KEY_CANDIDATES（pc 3 月 API，上游 10 月已改名）---
export const PROVIDER_ENV_API_KEY_CANDIDATES: Record<string, string[]> = {
  "github-copilot": ["COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"],
  anthropic: ["ANTHROPIC_OAUTH_TOKEN", "ANTHROPIC_API_KEY"],
  chutes: ["CHUTES_OAUTH_TOKEN", "CHUTES_API_KEY"],
  zai: ["ZAI_API_KEY", "Z_AI_API_KEY"],
  opencode: ["OPENCODE_API_KEY", "OPENCODE_ZEN_API_KEY"],
  "qwen-portal": ["QWEN_OAUTH_TOKEN", "QWEN_PORTAL_API_KEY"],
  volcengine: ["VOLCANO_ENGINE_API_KEY"],
  "volcengine-plan": ["VOLCANO_ENGINE_API_KEY"],
  byteplus: ["BYTEPLUS_API_KEY"],
  "byteplus-plan": ["BYTEPLUS_API_KEY"],
  "minimax-portal": ["MINIMAX_OAUTH_TOKEN", "MINIMAX_API_KEY"],
  "kimi-coding": ["KIMI_API_KEY", "KIMICODE_API_KEY"],
  huggingface: ["HUGGINGFACE_HUB_TOKEN", "HF_TOKEN"],
  openai: ["OPENAI_API_KEY"],
  google: ["GEMINI_API_KEY"],
  voyage: ["VOYAGE_API_KEY"],
  groq: ["GROQ_API_KEY"],
  deepgram: ["DEEPGRAM_API_KEY"],
  cerebras: ["CEREBRAS_API_KEY"],
  xai: ["XAI_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  litellm: ["LITELLM_API_KEY"],
  "vercel-ai-gateway": ["AI_GATEWAY_API_KEY"],
  "cloudflare-ai-gateway": ["CLOUDFLARE_AI_GATEWAY_API_KEY"],
  moonshot: ["MOONSHOT_API_KEY"],
  minimax: ["MINIMAX_API_KEY"],
  nvidia: ["NVIDIA_API_KEY"],
  xiaomi: ["XIAOMI_API_KEY"],
  synthetic: ["SYNTHETIC_API_KEY"],
  venice: ["VENICE_API_KEY"],
  mistral: ["MISTRAL_API_KEY"],
  together: ["TOGETHER_API_KEY"],
  qianfan: ["QIANFAN_API_KEY"],
  ollama: ["OLLAMA_API_KEY"],
  vllm: ["VLLM_API_KEY"],
  kilocode: ["KILOCODE_API_KEY"],
};
