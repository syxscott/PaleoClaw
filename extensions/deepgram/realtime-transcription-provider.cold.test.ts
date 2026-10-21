import "paleoclaw/plugin-sdk/compiled-subprocess-testing";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("paleoclaw/plugin-sdk/realtime-transcription");
  vi.resetModules();
});

it("constructs the provider without importing the broad transcription SDK", async () => {
  vi.resetModules();
  vi.doMock("paleoclaw/plugin-sdk/realtime-transcription", () => {
    throw new Error("provider construction imported the broad transcription SDK");
  });

  const { createRealtimeTranscriptionWebSocketSession } =
    await import("paleoclaw/plugin-sdk/realtime-transcription-session");
  const { buildDeepgramRealtimeTranscriptionProvider } =
    await import("./realtime-transcription-provider-factory.js");
  const provider = buildDeepgramRealtimeTranscriptionProvider({
    createRealtimeTranscriptionWebSocketSession,
  });
  expect(provider.id).toBe("deepgram");
  expect(provider.aliases).toContain("deepgram-realtime");
  expect(provider.createSession).toBeTypeOf("function");
});
