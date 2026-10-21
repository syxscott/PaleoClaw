import { buildManifestModelProviderConfig } from "paleoclaw/plugin-sdk/provider-catalog-shared";
import type { ModelProviderConfig } from "paleoclaw/plugin-sdk/provider-model-shared";
import manifest from "./paleoclaw.plugin.json" with { type: "json" };

export function buildMistralProvider(): ModelProviderConfig {
  return buildManifestModelProviderConfig({
    providerId: "mistral",
    catalog: manifest.modelCatalog.providers.mistral,
  });
}
