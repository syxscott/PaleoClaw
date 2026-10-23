// Full registration composes the same host operations supplied to a cold capability catalog.
import { resolveAgentDir } from "paleoclaw/plugin-sdk/agent-scope-runtime";
import { formatErrorMessage } from "paleoclaw/plugin-sdk/error-runtime";
import type { PluginCapabilityCatalogHostContext } from "paleoclaw/plugin-sdk/plugin-entry";
import {
  isProviderAuthProfileConfigured,
  isProviderAuthProfileConfiguredAsync,
  resolveProviderAuthProfileApiKey,
} from "paleoclaw/plugin-sdk/provider-auth";
import {
  createProviderHttpError,
  readProviderJsonResponse,
  readProviderTextResponse,
  resolveProviderRequestHeaders,
} from "paleoclaw/plugin-sdk/provider-http";
import {
  captureWsEventAsync,
  createDebugProxyWebSocketAgent,
  resolveDebugProxySettings,
} from "paleoclaw/plugin-sdk/proxy-capture";
import { createRealtimeTranscriptionWebSocketSession } from "paleoclaw/plugin-sdk/realtime-transcription-session";
import { warn } from "paleoclaw/plugin-sdk/runtime-env";
import { redactSensitiveText } from "paleoclaw/plugin-sdk/security-runtime";
import { fetchWithSsrFGuard } from "paleoclaw/plugin-sdk/ssrf-runtime";

export const openAIRealtimeHost = {
  resolveAgentDir,
  // Retained for public synchronous SDK calls through 2026-12-31.
  isProviderAuthProfileConfigured,
  isProviderAuthProfileConfiguredAsync,
  resolveProviderAuthProfileApiKey,
  resolveProviderRequestHeaders,
  createRealtimeTranscriptionWebSocketSession,
  captureWsEventAsync,
  createDebugProxyWebSocketAgent,
  resolveDebugProxySettings,
  fetchWithSsrFGuard,
  createProviderHttpError,
  readProviderJsonResponse,
  readProviderTextResponse,
  formatErrorMessage,
  warn,
  redactSensitiveText,
} satisfies Omit<
  PluginCapabilityCatalogHostContext,
  | "isProviderApiKeyConfigured"
  | "isProviderApiKeyConfiguredAsync"
  | "resolveApiKeyForProvider"
  | "captureWsEvent"
>;

export type OpenAIRealtimeHost = typeof openAIRealtimeHost;
