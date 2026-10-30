import type { ProviderDefaultThinkingPolicyContext } from "paleoclaw/plugin-sdk/plugin-entry";
import { resolveOpenRouterThinkingProfile } from "./thinking-policy.js";

export function resolveThinkingProfile(params: ProviderDefaultThinkingPolicyContext) {
  return resolveOpenRouterThinkingProfile(params.modelId, params);
}
