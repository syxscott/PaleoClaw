// Compile once per test invocation so process-exit proof uses packaged worker startup.
export const stateLeaseProcessExitRuntimeEntrypoint = {
  currentModuleUrl: import.meta.url,
  sourceWorkerName: "paleoclaw-state-lease-process-exit-child.test-support",
  distWorkerPath: "state/paleoclaw-state-lease-process-exit-child.test-support.js",
} as const;

export const stateLeaseRetentionRuntimeEntrypoint = {
  currentModuleUrl: import.meta.url,
  sourceWorkerName: "paleoclaw-state-lease.retention.test-support",
  distWorkerPath: "state/paleoclaw-state-lease.retention.test-support.js",
} as const;

export const agentDatabaseHeldRuntimeEntrypoint = {
  currentModuleUrl: import.meta.url,
  sourceWorkerName: "paleoclaw-agent-db-held-child.test-support",
  distWorkerPath: "state/paleoclaw-agent-db-held-child.test-support.js",
} as const;
