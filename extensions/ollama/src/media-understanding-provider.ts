import type { MediaUnderstandingProvider } from "paleoclaw/plugin-sdk/media-understanding";
import { OLLAMA_PROVIDER_ID } from "./discovery-shared.js";

export const ollamaMediaUnderstandingProvider: MediaUnderstandingProvider = {
  id: OLLAMA_PROVIDER_ID,
  capabilities: ["image"],
};
