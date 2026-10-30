import { isTranscriptOnlyOpenClawAssistantMessage } from "../../../shared/transcript-only-paleoclaw-assistant.js";
import type { SessionManager } from "../../sessions/index.js";

export const preserveTrailingTranscriptMetadata = (
  entry: ReturnType<SessionManager["getEntries"]>[number],
) =>
  entry.type === "custom" ||
  entry.type === "label" ||
  entry.type === "session_info" ||
  (entry.type === "message" && isTranscriptOnlyOpenClawAssistantMessage(entry.message));
