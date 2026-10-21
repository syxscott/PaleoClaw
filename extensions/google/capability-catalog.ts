import type { PluginCapabilityCatalog } from "paleoclaw/plugin-sdk/plugin-entry";
import { createLazyGoogleRealtimeVoiceProvider } from "./realtime-voice-lazy.js";
import { buildGoogleSpeechProvider } from "./speech-provider.js";

export default {
  speechProviders: [buildGoogleSpeechProvider()],
  realtimeVoiceProviders: [createLazyGoogleRealtimeVoiceProvider()],
} satisfies PluginCapabilityCatalog;
