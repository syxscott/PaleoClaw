import type { PluginCompatRecord } from "./types.js";

/**
 * JavaScript-only SDK facades are not typed contracts, but published plugins link these names;
 * the contract test asserts each surface stays exported from its packaged subpath.
 */
export const PLUGIN_SDK_PRIVATE_RUNTIME_EXPORT_COMPAT_RECORD = {
  code: "plugin-sdk-private-runtime-shipped-exports",
  status: "deprecated",
  owner: "sdk",
  deprecated: "2026-10-15",
  warningStarts: "2026-10-15",
  removeAfter: "2027-01-15",
  replacement:
    "Import the helper from a typed public SDK subpath that exports it, or keep a plugin-local copy; these JavaScript-only runtime facades are not a typed third-party contract",
  docsPath: "/plugins/sdk-migration/compatibility-policy#private-runtime-facade-exports",
  surfaces: [
    "paleoclaw/plugin-sdk/acp-runtime.getAcpRuntimeBackend",
    "paleoclaw/plugin-sdk/approval-reaction-runtime.readApprovalReactionDeliveryMetadata",
    "paleoclaw/plugin-sdk/fetch-runtime.hasEnvHttpProxyConfigured",
    "paleoclaw/plugin-sdk/image-generation-core.resolveAgentModelPrimaryValue",
    "paleoclaw/plugin-sdk/image-generation-core.resolveApiKeyForProvider",
    "paleoclaw/plugin-sdk/memory-core-host-engine-embeddings.fetchRemoteEmbeddingVectors",
    "paleoclaw/plugin-sdk/memory-core-host-engine-embeddings.listMemoryEmbeddingProviders",
    "paleoclaw/plugin-sdk/memory-core-host-engine-storage.chunkMarkdown",
    "paleoclaw/plugin-sdk/memory-core-host-engine-storage.ensureDir",
    "paleoclaw/plugin-sdk/memory-core-host-runtime-files.listMemoryFiles",
    "paleoclaw/plugin-sdk/memory-core-host-runtime-files.normalizeExtraMemoryPaths",
    "paleoclaw/plugin-sdk/poll-runtime.resolvePollMaxSelections",
    "paleoclaw/plugin-sdk/provider-stream.createOpenRouterSystemCacheWrapper",
    "paleoclaw/plugin-sdk/provider-stream.resolveMoonshotThinkingType",
    "paleoclaw/plugin-sdk/provider-web-fetch.enablePluginInConfig",
    "paleoclaw/plugin-sdk/provider-web-fetch.jsonResult",
    "paleoclaw/plugin-sdk/provider-web-fetch.withTrustedWebToolsEndpoint",
    "paleoclaw/plugin-sdk/provider-web-fetch.wrapExternalContent",
    "paleoclaw/plugin-sdk/provider-web-fetch.wrapWebContent",
    "paleoclaw/plugin-sdk/provider-web-search.DEFAULT_TIMEOUT_SECONDS",
    "paleoclaw/plugin-sdk/provider-web-search.markdownToText",
    "paleoclaw/plugin-sdk/provider-web-search.setScopedCredentialValue",
    "paleoclaw/plugin-sdk/provider-web-search.setTopLevelCredentialValue",
    "paleoclaw/plugin-sdk/retry-runtime.createRateLimitRetryRunner",
    "paleoclaw/plugin-sdk/speech.readResponseTextLimited",
    "paleoclaw/plugin-sdk/speech.truncateErrorDetail",
    "paleoclaw/plugin-sdk/thread-bindings-runtime.resolveThreadBindingConversationIdFromBindingId",
    "paleoclaw/plugin-sdk/thread-bindings-runtime.resolveThreadBindingFarewellText",
    "paleoclaw/plugin-sdk/thread-bindings-runtime.resolveThreadBindingLifecycle",
  ],
  diagnostics: [
    "TypeScript @deprecated annotations and the private runtime shipped-export contract test",
  ],
} as const satisfies PluginCompatRecord;
