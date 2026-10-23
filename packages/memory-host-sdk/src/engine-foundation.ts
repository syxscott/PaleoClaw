// Real workspace contract for memory engine foundation concerns.

export {
  resolveAgentContextLimits,
  resolveAgentDir,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
  resolveSessionAgentId,
} from "./host/paleoclaw-runtime-agent.js";
export {
  resolveMemorySearchConfig,
  resolveMemorySearchSyncConfig,
  type ResolvedMemorySearchConfig,
  type ResolvedMemorySearchSyncConfig,
} from "./host/paleoclaw-runtime-agent.js";
export { parseDurationMs } from "./host/paleoclaw-runtime-config.js";
export { resolveStateDir } from "./host/paleoclaw-runtime-config.js";
export { resolveSessionTranscriptsDirForAgent } from "./host/paleoclaw-runtime-config.js";
export {
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
} from "./host/paleoclaw-runtime-config.js";
export { root } from "./host/paleoclaw-runtime-io.js";
export { isPathInside } from "./host/fs-utils.js";
export { createSubsystemLogger } from "./host/paleoclaw-runtime-io.js";
export { detectMime } from "./host/paleoclaw-runtime-io.js";
export { resolveGlobalSingleton } from "./host/paleoclaw-runtime-io.js";
export { onSessionTranscriptUpdate } from "./host/paleoclaw-runtime-session.js";
export { splitShellArgs } from "./host/paleoclaw-runtime-io.js";
export { runTasksWithConcurrency } from "./host/paleoclaw-runtime-io.js";
export {
  shortenHomeInString,
  shortenHomePath,
  resolveUserPath,
  truncateUtf16Safe,
} from "./host/paleoclaw-runtime-io.js";
export type { OpenClawConfig } from "./host/paleoclaw-runtime-config.js";
export type { SecretInput } from "./host/paleoclaw-runtime-config.js";
export type { MemoryCitationsMode } from "./host/paleoclaw-runtime-config.js";
export type { MemorySearchConfig } from "./host/paleoclaw-runtime-config.js";
