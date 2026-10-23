import type { PluginCapabilityCatalog } from "paleoclaw/plugin-sdk/plugin-entry";
import { buildXiaomiSpeechProvider } from "./speech-provider.js";

export default {
  speechProviders: [buildXiaomiSpeechProvider()],
} satisfies PluginCapabilityCatalog;
