import type { PluginCompatRecord } from "./types.js";

// The final compatibility day precedes removal in the first January 2027 stable release.
const PREPARATION = {
  status: "deprecated",
  owner: "sdk",
  deprecated: "2026-10-13",
  warningStarts: "2026-10-13",
  removeAfter: "2026-12-31",
  diagnostics: [
    "TypeScript @deprecated annotations and actionable once-per-plugin-and-capability-family warnings per process on legacy use",
  ],
} as const;

export const ASYNC_SQLITE_PREPARATION_COMPAT_RECORDS = [
  {
    ...PREPARATION,
    code: "provider-model-capabilities-sync-read",
    replacement:
      "Await loadOpenRouterModelCapabilities(modelId), then read getLoadedOpenRouterModelCapabilities(modelId). The synchronous getter remains compatible through 2026-12-31; removal ships in the first January 2027 stable release.",
    docsPath: "/plugins/sdk-migration/sqlite-async",
    surfaces: [
      "paleoclaw/plugin-sdk/provider-stream.getOpenRouterModelCapabilities",
      "paleoclaw/plugin-sdk/provider-stream-family.getOpenRouterModelCapabilities",
    ],
  },
  {
    ...PREPARATION,
    code: "session-store-sync-readers",
    replacement:
      "Await getSessionEntryAsync, getConversationSessionAsync, readAmbientTranscriptWatermarkAsync, and loadTranscriptEvents. Synchronous readers retain their results during the stable deprecation period. Current entry lookup is not a substitute for historical transcript-key resolution.",
    docsPath: "/plugins/sdk-migration/how-to-migrate#await-session-and-transcript-readers",
    surfaces: [
      "paleoclaw/plugin-sdk/session-store-runtime.getSessionEntry",
      "paleoclaw/plugin-sdk/session-store-runtime.getConversationSession",
      "paleoclaw/plugin-sdk/session-store-runtime.readAmbientTranscriptWatermark",
      "paleoclaw/plugin-sdk/session-store-runtime.loadTranscriptEventsSync",
      "api.runtime.agent.session.getSessionEntry",
      "api.runtime.agent.session.getConversationSession",
    ],
  },
  {
    ...PREPARATION,
    code: "transcript-session-key-sync-resolution",
    replacement:
      "Await resolveTranscriptSessionKeyBySessionIdAsync from session-store-runtime. It preserves exact historical session-window resolution, including session IDs no longer selected by the current entry.",
    docsPath: "/plugins/sdk-migration/async-transcript-and-tts",
    surfaces: ["paleoclaw/plugin-sdk/session-store-runtime.resolveTranscriptSessionKeyBySessionId"],
  },
  {
    ...PREPARATION,
    code: "pending-input-sync-completion",
    replacement:
      "Await SessionPendingInputReceipt.completeAsync or UserTurnTranscriptRecorder.completeProcessingAsync before publishing completion. Await waitForPendingInputSettlement when supplied before releasing session admission. Bundled plugins target the current host and use the async companions directly; do not retry async failures synchronously.",
    docsPath: "/plugins/sdk-migration/how-to-migrate#await-session-transcript-persistence",
    surfaces: [
      "SessionPendingInputReceipt.complete",
      "UserTurnTranscriptRecorder.completeProcessing",
    ],
  },
  {
    ...PREPARATION,
    code: "session-catalog-sync-preparation",
    replacement:
      "Await readSessionTranscriptCatalogTitleAsync, prepareSessionCatalogSourceActorProjector, and prepareSessionCatalogGitHubLinker from session-transcript-runtime. Project the prepared facts synchronously and retain current disclosure authority at publication.",
    docsPath: "/plugins/sdk-migration/how-to-migrate#prepare-session-catalog-identities",
    surfaces: [
      "paleoclaw/plugin-sdk/session-transcript-runtime.readSessionTranscriptCatalogTitle",
      "paleoclaw/plugin-sdk/session-transcript-runtime.createSessionCatalogSourceActorProjector",
      "paleoclaw/plugin-sdk/session-transcript-runtime.createSessionCatalogGitHubLinker",
    ],
  },
  {
    ...PREPARATION,
    code: "channel-policy-sync-preparation",
    replacement:
      "Await resolveCommandAuthorizationAsync, resolveStoredModelOverrideAsync, resolveCommandArgMenuAsync, inspectConversationBindingAsync, and loadExecApprovalsReadOnlyAsync. Prepared results never replace live authorization at command execution or external side effects.",
    docsPath:
      "/plugins/sdk-migration/how-to-migrate#migrate-inspection-authorization-and-approval-factories",
    surfaces: [
      "paleoclaw/plugin-sdk/command-auth-native.resolveCommandAuthorization",
      "paleoclaw/plugin-sdk/command-auth-native.resolveStoredModelOverride",
      "paleoclaw/plugin-sdk/command-auth-native.resolveCommandArgMenu",
      "paleoclaw/plugin-sdk/conversation-binding-inspection-runtime.inspectConversationBinding",
      "paleoclaw/plugin-sdk/exec-approvals-runtime.loadExecApprovals",
    ],
  },
  {
    ...PREPARATION,
    code: "approval-routing-sync-preparation",
    replacement:
      "Use the Async-suffixed approval factories and resolvers, then await their returned eligibility and routing callbacks. Reuse resolveApprovalRequestSessionDeliveryAsync facts for one route decision. Factories remain synchronous; Async names describe their awaited callbacks. Keep live approval and delivery authority at the effect boundary.",
    docsPath:
      "/plugins/sdk-migration/how-to-migrate#migrate-inspection-authorization-and-approval-factories",
    surfaces: [
      "paleoclaw/plugin-sdk/approval-delivery-runtime.createApproverRestrictedNativeApprovalCapability",
      "paleoclaw/plugin-sdk/approval-handler-runtime.createChannelApprovalNativeRuntimeAdapter",
      "paleoclaw/plugin-sdk/approval-handler-adapter-runtime.createLazyChannelApprovalNativeRuntimeAdapter",
      "paleoclaw/plugin-sdk/approval-delivery-runtime.createApproverRestrictedNativeApprovalCapabilityFromForwardingRoutes",
      "paleoclaw/plugin-sdk/approval-native-runtime.createNativeApprovalChannelRouteGates",
      "paleoclaw/plugin-sdk/approval-native-runtime.createChannelNativeOriginTargetResolver",
      "paleoclaw/plugin-sdk/approval-client-runtime.createChannelExecApprovalProfile",
      "paleoclaw/plugin-sdk/approval-native-runtime.createChannelApproverDmTargetResolver",
      "paleoclaw/plugin-sdk/approval-native-runtime.createNativeApprovalForwardingFallbackSuppressor",
      "paleoclaw/plugin-sdk/approval-runtime.resolveExecApprovalSessionTarget",
      "paleoclaw/plugin-sdk/approval-runtime.resolveApprovalRequestSessionTarget",
      "paleoclaw/plugin-sdk/approval-runtime.resolveApprovalRequestOriginTarget",
      "paleoclaw/plugin-sdk/approval-native-runtime.resolveApprovalRequestAccountId",
      "paleoclaw/plugin-sdk/approval-native-runtime.resolveApprovalRequestChannelAccountId",
      "paleoclaw/plugin-sdk/approval-runtime.doesApprovalRequestMatchChannelAccount",
      "paleoclaw/plugin-sdk/approval-native-runtime.doesApprovalRequestSelectChannelAccount",
    ],
  },
  {
    ...PREPARATION,
    code: "debug-proxy-sync-capture",
    replacement:
      "Acquire acquireDebugProxyCaptureStoreAsync, await store operations, and await lease.release in finally. Use createDebugProxyCaptureReaderAsync and await reads. Use initializeDebugProxyCaptureAsync, captureHttpExchangeAsync, captureWsEventAsync, and finalizeDebugProxyCaptureAsync, including the context captureWsEventAsync companion. Do not fire and forget persistence or fall back after an async failure.",
    docsPath: "/plugins/sdk-migration/how-to-migrate#await-debug-proxy-capture",
    surfaces: [
      "paleoclaw/plugin-sdk/proxy-capture.DebugProxyCaptureReader",
      "paleoclaw/plugin-sdk/proxy-capture.DebugProxyCaptureStore",
      "paleoclaw/plugin-sdk/proxy-capture.getDebugProxyCaptureStore",
      "paleoclaw/plugin-sdk/proxy-capture.acquireDebugProxyCaptureStore",
      "paleoclaw/plugin-sdk/proxy-capture.closeDebugProxyCaptureStore",
      "paleoclaw/plugin-sdk/proxy-capture.createDebugProxyCaptureReader",
      "paleoclaw/plugin-sdk/proxy-capture.initializeDebugProxyCapture",
      "paleoclaw/plugin-sdk/proxy-capture.captureHttpExchange",
      "paleoclaw/plugin-sdk/proxy-capture.captureWsEvent",
      "paleoclaw/plugin-sdk/proxy-capture.finalizeDebugProxyCapture",
      "DebugProxyCaptureContext.captureWsEvent",
    ],
  },
] as const satisfies readonly PluginCompatRecord[];
