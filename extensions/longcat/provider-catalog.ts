import { buildManifestModelProviderConfig } from "paleoclaw/plugin-sdk/provider-catalog-shared";
import type { ModelProviderConfig } from "paleoclaw/plugin-sdk/provider-model-shared";
import manifest from "./openclaw.plugin.json" with { type: "json" };

export function buildLongCatProvider(): ModelProviderConfig {
  return buildManifestModelProviderConfig({
    providerId: "longcat",
    catalog: manifest.modelCatalog.providers.longcat,
  });
}
