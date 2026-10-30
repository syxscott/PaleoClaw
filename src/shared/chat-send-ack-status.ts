import { normalizeLowercaseStringOrEmpty } from "@paleoclaw/normalization-core/string-coerce";

export function normalizeTerminalChatSendAckStatus(
  status: unknown,
): "ok" | "timeout" | "error" | undefined {
  const normalized = normalizeLowercaseStringOrEmpty(status);
  return normalized === "ok" || normalized === "timeout" || normalized === "error"
    ? normalized
    : undefined;
}
