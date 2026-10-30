import { definePluginEntry } from "paleoclaw/plugin-sdk/plugin-entry";
import { createDuckDuckGoWebSearchProvider } from "./src/ddg-search-provider.js";

export default definePluginEntry({
  id: "duckduckgo",
  name: "DuckDuckGo Plugin",
  description: "Official DuckDuckGo web search plugin",
  register(api) {
    api.registerWebSearchProvider(createDuckDuckGoWebSearchProvider());
  },
});
