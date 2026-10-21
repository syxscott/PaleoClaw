// Native state probes share the invocation's compiled graph before starting child deadlines.
export const stateNativeProcessEntrypoints = {
  localOnboarding: {
    currentModuleUrl: import.meta.url,
    sourceWorkerName: "local-onboarding-state.test-support",
    distWorkerPath: "state/local-onboarding-state.test-support.js",
  },
  agentDatabaseCrash: {
    currentModuleUrl: import.meta.url,
    sourceWorkerName: "paleoclaw-agent-db-crash.test-support",
    distWorkerPath: "state/paleoclaw-agent-db-crash.test-support.js",
  },
  canonicalReceipt: {
    currentModuleUrl: import.meta.url,
    sourceWorkerName: "paleoclaw-agent-canonical-validation-receipt.test-support",
    distWorkerPath: "state/paleoclaw-agent-canonical-validation-receipt.test-support.js",
  },
  agentDatabase: {
    currentModuleUrl: import.meta.url,
    sourceWorkerName: "paleoclaw-agent-db",
    distWorkerPath: "state/paleoclaw-agent-db.js",
  },
  stateDatabase: {
    currentModuleUrl: import.meta.url,
    sourceWorkerName: "paleoclaw-state-db",
    distWorkerPath: "state/paleoclaw-state-db.js",
  },
  stateDatabaseCache: {
    currentModuleUrl: import.meta.url,
    sourceWorkerName: "paleoclaw-state-db-cache",
    distWorkerPath: "state/paleoclaw-state-db-cache.js",
  },
  stateLease: {
    currentModuleUrl: import.meta.url,
    sourceWorkerName: "paleoclaw-state-lease",
    distWorkerPath: "state/paleoclaw-state-lease.js",
  },
  loggingState: {
    currentModuleUrl: import.meta.url,
    sourceWorkerName: "../logging/state",
    distWorkerPath: "logging/state.js",
  },
  gatewayStateOwner: {
    currentModuleUrl: import.meta.url,
    sourceWorkerName: "../infra/gateway-state-owner",
    distWorkerPath: "infra/gateway-state-owner.js",
  },
  sqliteReadOnlyLocation: {
    currentModuleUrl: import.meta.url,
    sourceWorkerName: "../infra/sqlite-readonly-location",
    distWorkerPath: "infra/sqlite-readonly-location.js",
  },
  nodeSqlite: {
    currentModuleUrl: import.meta.url,
    sourceWorkerName: "../infra/node-sqlite",
    distWorkerPath: "infra/node-sqlite.js",
  },
} as const;
