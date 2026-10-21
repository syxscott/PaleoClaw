import type { ModelProviderConfig } from "paleoclaw/plugin-sdk/provider-model-shared";
import { VENICE_BASE_URL, VENICE_MODEL_CATALOG } from "./models.js";

export function buildStaticVeniceProvider(): ModelProviderConfig {
  return {
    baseUrl: VENICE_BASE_URL,
    api: "openai-completions",
    models: VENICE_MODEL_CATALOG,
  };
}
