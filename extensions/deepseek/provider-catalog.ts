import type { ModelProviderConfig } from "paleoclaw/plugin-sdk/provider-model-shared";
import { DEEPSEEK_BASE_URL, DEEPSEEK_MODEL_CATALOG } from "./models.js";

export function buildDeepSeekProvider(): ModelProviderConfig {
  return {
    baseUrl: DEEPSEEK_BASE_URL,
    api: "openai-completions",
    models: DEEPSEEK_MODEL_CATALOG,
  };
}
