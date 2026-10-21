export const codexHistoryWorkerEntrypoint = {
  currentModuleUrl: import.meta.url,
  sourceWorkerName: "session-history.worker",
  distWorkerPath: "extensions/codex/session-history.worker.js",
  package: {
    name: "@paleoclaw/codex",
    distWorkerPath: "session-history.worker.js",
  },
} as const;
