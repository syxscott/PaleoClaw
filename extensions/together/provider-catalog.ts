import { buildManifestModelProviderConfig } from "paleoclaw/plugin-sdk/provider-catalog-shared";
import type { ModelProviderConfig } from "paleoclaw/plugin-sdk/provider-model-shared";
import manifest from "./paleoclaw.plugin.json" with { type: "json" };

export function buildTogetherProvider(): ModelProviderConfig {
  return buildManifestModelProviderConfig({
    providerId: "together",
    catalog: manifest.modelCatalog.providers.together,
  });
}
