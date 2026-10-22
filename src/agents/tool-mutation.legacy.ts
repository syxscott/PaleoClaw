// Legacy name-only mutation heuristic.
// Upstream moved tool mutation classification behind classifyToolCall(toolName, args),
// which needs the call arguments. The legacy embedded runner only has the tool name,
// so keep the original name-level heuristic here instead of guessing from args.
const MUTATING_TOOL_NAMES = new Set([
  "write",
  "edit",
  "apply_patch",
  "exec",
  "bash",
  "process",
  "message",
  "sessions_send",
  "cron",
  "gateway",
  "canvas",
  "nodes",
  "session_status",
]);

export function isLikelyMutatingToolName(toolName: string): boolean {
  const normalized = toolName.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    MUTATING_TOOL_NAMES.has(normalized) ||
    normalized.endsWith("_actions") ||
    normalized.startsWith("message_") ||
    normalized.includes("send")
  );
}

export type ToolActionRef = {
  toolName: string;
  meta?: string;
  actionFingerprint?: string;
};

/**
 * Compare a recorded tool failure against the call that just succeeded.
 *
 * Upstream replaced the recorded-action bookkeeping with action fingerprints
 * carried on the mutation state, so the standalone comparator no longer exists
 * there. Keep it for the legacy embedded runner's error-recovery path.
 */
export function isSameToolMutationAction(existing: ToolActionRef, next: ToolActionRef): boolean {
  if (existing.actionFingerprint != null || next.actionFingerprint != null) {
    // For mutating flows, fail closed: only clear when both fingerprints exist and match.
    return (
      existing.actionFingerprint != null &&
      next.actionFingerprint != null &&
      existing.actionFingerprint === next.actionFingerprint
    );
  }
  return existing.toolName === next.toolName && (existing.meta ?? "") === (next.meta ?? "");
}
