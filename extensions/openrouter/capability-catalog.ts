import type { PluginCapabilityCatalog } from "paleoclaw/plugin-sdk/plugin-entry";
import { buildOpenRouterSpeechProvider } from "./speech-provider.js";

export default {
  speechProviders: [buildOpenRouterSpeechProvider()],
} satisfies PluginCapabilityCatalog;
