import type { PluginCapabilityCatalog } from "paleoclaw/plugin-sdk/plugin-entry";
import { buildVydraSpeechProvider } from "./speech-provider.js";

export default {
  speechProviders: [buildVydraSpeechProvider()],
} satisfies PluginCapabilityCatalog;
