export { buildGuardedModelFetch } from "../agents/provider-transport-fetch.js";
export { buildOpenAICompletionsParams } from "../agents/openai-transport-stream.js";
export { buildAssistantMessage } from "../agents/stream-message-shared.js";
/** @deprecated Bundled provider option composition; not a third-party SDK contract. */
export { applyAnthropicThinkingOptions } from "@paleoclaw/ai/internal/anthropic";
/** @deprecated Bundled provider transport primitives; not a third-party SDK contract. */
export { clampMaxTokensToModel, iterateSseFrames } from "@paleoclaw/ai/internal/shared";
export {
  sortPromptCacheToolsByName,
  splitSystemPromptCacheBoundary,
  splitSystemPromptRelocatableBoundary,
  stripSystemPromptCacheBoundary,
} from "@paleoclaw/ai/internal/shared";
export { transformTransportMessages } from "../agents/transport-message-transform.js";
export {
  describeToolResultMediaPlaceholder,
  describeUnsupportedToolResultMedia,
  extractToolResultText,
  formatToolResultText,
  isImageWithMediaPayload,
} from "@paleoclaw/ai/internal/shared";
export {
  buildGoogleGenerationConfig,
  buildGoogleSimpleThinking,
  coerceTransportToolCallArguments,
  consumeGoogleGenerateContentStream,
  convertGoogleTools,
  projectGoogleMessages,
  requiresGoogleToolCallId,
  type GoogleStreamChunk,
  copyProviderAcceptanceObserver,
  createEmptyTransportUsage,
  createWritableTransportEventStream,
  createProviderWaitObserver,
  failTransportStream,
  finalizeTerminalToolCallArguments,
  finalizeTransportStream,
  MALFORMED_STREAMING_FRAGMENT_ERROR_MESSAGE,
  mergeTransportHeaders,
  notifyProviderHttpMetadata,
  notifyProviderHttpResponse,
  notifyProviderStreamOpened,
  parseTerminalToolCallArguments,
  sanitizeTransportPayloadText,
  withProviderAcceptanceObserver,
  type WritableTransportStream,
} from "@paleoclaw/ai/transports";
