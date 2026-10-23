import type { WebSearchProviderPlugin } from "paleoclaw/plugin-sdk/provider-web-search-contract";
import { createCodexWebSearchProviderBase } from "./src/web-search-provider.shared.js";

export function createCodexWebSearchProvider(): WebSearchProviderPlugin {
  return {
    ...createCodexWebSearchProviderBase(),
    createTool: () => null,
  };
}
