export const documentExtractorWorkerEntrypoint = {
  currentModuleUrl: import.meta.url,
  sourceWorkerName: "document-extractor.worker",
  package: {
    name: "@paleoclaw/document-extract-plugin",
    distWorkerPath: "document-extractor.worker.js",
  },
  distWorkerPath: "extensions/document-extract/document-extractor.worker.js",
} as const;
