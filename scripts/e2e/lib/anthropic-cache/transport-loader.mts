import type { StreamFn, StreamFunction } from "@paleoclaw/ai";

export type AnthropicStreamFn = StreamFunction<"anthropic-messages">;

type AnthropicProviderInternals = {
  streamAnthropic: AnthropicStreamFn;
  bindsClaudeThinkingPrefix?: (model: { id?: string }) => boolean;
};

type AnthropicProviderImporter = () => Promise<AnthropicProviderInternals>;

type AnthropicTransportImporter = () => Promise<
  Pick<typeof import("@paleoclaw/ai/transports"), "createAnthropicMessagesTransportStreamFn">
>;

function isMissingTransportExport(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED" &&
    error.message.includes("@paleoclaw/ai") &&
    error.message.includes("transports")
  );
}

export async function loadAnthropicTransportStream(
  importer: AnthropicTransportImporter = () => import("@paleoclaw/ai/transports"),
): Promise<StreamFn | undefined> {
  try {
    const module = await importer();
    return module.createAnthropicMessagesTransportStreamFn();
  } catch (error) {
    if (isMissingTransportExport(error)) {
      return undefined;
    }
    throw error;
  }
}

export async function loadAnthropicProviderInternals(
  importer: AnthropicProviderImporter = () => import("@paleoclaw/ai/internal/anthropic"),
): Promise<Required<AnthropicProviderInternals>> {
  const module = await importer();
  if (typeof module.streamAnthropic !== "function") {
    throw new TypeError("candidate package does not export streamAnthropic");
  }
  return {
    streamAnthropic: module.streamAnthropic,
    // Packages predating the prefix-binding contract cannot expose a model
    // that requires it. Keep the fallback scoped to that missing capability.
    bindsClaudeThinkingPrefix: module.bindsClaudeThinkingPrefix ?? (() => false),
  };
}
