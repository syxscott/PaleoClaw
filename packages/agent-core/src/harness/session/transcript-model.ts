export const OPENCLAW_TRANSCRIPT_ARTIFACT_PROVIDER = "paleoclaw" as const;

/** Transcript authorship is not an inference model, even when the message is replayable. */
export function isTranscriptArtifactProvider(provider: unknown): boolean {
  return provider === OPENCLAW_TRANSCRIPT_ARTIFACT_PROVIDER;
}
