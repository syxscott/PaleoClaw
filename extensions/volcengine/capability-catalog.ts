import type { PluginCapabilityCatalog } from "paleoclaw/plugin-sdk/plugin-entry";
import { buildVolcengineSpeechProvider } from "./speech-provider.js";

export default {
  speechProviders: [buildVolcengineSpeechProvider()],
} satisfies PluginCapabilityCatalog;
