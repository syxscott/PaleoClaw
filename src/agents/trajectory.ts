import fs from "node:fs/promises";
import { redactSensitiveText } from "../logging/redact.js";
import { sanitizeDiagnosticPayload } from "./payload-redaction.js";

/**
 * The kind of a trajectory event. Events of the same kind can be filtered out
 * of the stream, which is the "inspect by source" view of the DeepSeek
 * Harness trajectory log.
 */
export type TrajectoryEventKind =
  | "system:stable"
  | "system:dynamic"
  | "user:prompt"
  | "assistant:text"
  | "assistant:reasoning"
  | "tool:call"
  | "tool:result"
  | "context:injection";

/** Where the recorded content came from. */
export type TrajectorySource =
  | "system"
  | "user"
  | "assistant"
  | "tool"
  | "context"
  | "hook"
  | "context-engine"
  | "profile"
  | "auto-tools"
  | "memory";

export type TrajectoryEvent = {
  ts: string;
  seq: number;
  kind: TrajectoryEventKind;
  source: TrajectorySource;
  runId?: string;
  sessionId?: string;
  sessionKey?: string;
  provider?: string;
  modelId?: string;
  modelApi?: string | null;
  workspaceDir?: string;
  /** Redacted text payload (prompt text, assistant text, reasoning, ...). */
  text?: string;
  /** Redacted structured payload (tool arguments, tool results, ...). */
  data?: unknown;
  note?: string;
};

/** Markers of the context blocks the runtime prepends to the user prompt. */
const CONTEXT_INJECTION_MARKERS: ReadonlyArray<{
  source: TrajectorySource;
  open: string;
  close: string;
}> = [
  { source: "profile", open: "<paleoclaw-profile-context>", close: "</paleoclaw-profile-context>" },
  { source: "auto-tools", open: "<paleoclaw-tools-context>", close: "</paleoclaw-tools-context>" },
  { source: "memory", open: "<memory-context>", close: "</memory-context>" },
];

/**
 * Redact secret-shaped values from a free-text payload.
 *
 * Uses the repository-wide redaction rules (API keys, bearer tokens,
 * authorization headers, PEM blocks, ...), so the trajectory stream never
 * persists a credential.
 */
export function redactTrajectoryText(text: string): string {
  if (!text) {
    return text;
  }
  return redactSensitiveText(text, { mode: "tools" });
}

function redactStringsDeep(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return redactTrajectoryText(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactStringsDeep(entry, seen));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactTrajectoryText(value.message),
      stack: value.stack ? redactTrajectoryText(value.stack) : value.stack,
    };
  }
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    out[key] = redactStringsDeep(entry, seen);
  }
  return out;
}

/**
 * Redact a structured payload: image data is replaced by the shared
 * diagnostics placeholder and every embedded string is scanned for secrets.
 */
export function redactTrajectoryData(value: unknown): unknown {
  const withoutImages = sanitizeDiagnosticPayload(value);
  return redactStringsDeep(withoutImages, new WeakSet<object>());
}

export type ContextInjection = {
  source: TrajectorySource;
  text: string;
};

/**
 * Detect the context blocks that the runtime prepends to the user prompt
 * (profile block, auto-tool context, memory fence).
 */
export function detectContextInjections(prompt: string): ContextInjection[] {
  if (!prompt) {
    return [];
  }
  const found: ContextInjection[] = [];
  for (const marker of CONTEXT_INJECTION_MARKERS) {
    const start = prompt.indexOf(marker.open);
    if (start < 0) {
      continue;
    }
    const end = prompt.indexOf(marker.close, start + marker.open.length);
    const stop = end < 0 ? prompt.length : end + marker.close.length;
    found.push({ source: marker.source, text: prompt.slice(start, stop) });
  }
  return found;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const TRAJECTORY_KINDS: readonly TrajectoryEventKind[] = [
  "system:stable",
  "system:dynamic",
  "user:prompt",
  "assistant:text",
  "assistant:reasoning",
  "tool:call",
  "tool:result",
  "context:injection",
];

export function isTrajectoryEventKind(value: unknown): value is TrajectoryEventKind {
  return typeof value === "string" && (TRAJECTORY_KINDS as readonly string[]).includes(value);
}

/**
 * Read the trajectory events out of a cache-trace JSONL file.
 *
 * Legacy cache-trace lines (which have no `kind`) are skipped: the file stays
 * backwards compatible, the trajectory view is a filtered projection of it.
 */
export async function readTrajectoryEvents(filePath: string): Promise<TrajectoryEvent[]> {
  const raw = await fs.readFile(filePath, "utf8").catch(() => "");
  const events: TrajectoryEvent[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!isRecord(parsed) || !isTrajectoryEventKind(parsed.kind)) {
      continue;
    }
    events.push(parsed as unknown as TrajectoryEvent);
  }
  return events;
}

/** List the event kinds present in a run, in first-seen order. */
export function listTrajectoryKinds(events: TrajectoryEvent[]): TrajectoryEventKind[] {
  const kinds: TrajectoryEventKind[] = [];
  const seen = new Set<TrajectoryEventKind>();
  for (const event of events) {
    if (!isTrajectoryEventKind(event.kind) || seen.has(event.kind)) {
      continue;
    }
    seen.add(event.kind);
    kinds.push(event.kind);
  }
  return kinds;
}

/** Return the subset of events whose kind is in `kinds`. */
export function filterTrajectoryEvents(
  events: TrajectoryEvent[],
  kinds: readonly TrajectoryEventKind[],
): TrajectoryEvent[] {
  if (kinds.length === 0) {
    return [];
  }
  const wanted = new Set(kinds);
  return events.filter((event) => wanted.has(event.kind));
}
