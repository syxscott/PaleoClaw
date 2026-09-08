import type { GatewayBrowserClient } from "../gateway.ts";
import type { LogEntry, LogLevel } from "../types.ts";

export type LogsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  logsLoading: boolean;
  logsError: string | null;
  logsCursor: number | null;
  logsFile: string | null;
  logsEntries: LogEntry[];
  logsTruncated: boolean;
  logsLastFetchAt: number | null;
  logsLimit: number;
  logsMaxBytes: number;
};

const LOG_BUFFER_LIMIT = 2000;
const LEVELS = new Set<LogLevel>(["trace", "debug", "info", "warn", "error", "fatal"]);

// Quiet (polling) loads don't touch logsLoading, so overlapping 2s polls can
// race: a slow tail followed by a full load (or a duplicate poll) would apply
// an out-of-order response and regress the cursor / duplicate entries.
// logsQuietInFlight skips redundant quiet ticks; logsLoadGeneration lets a
// full load invalidate a quiet tail that is still in flight.
let logsQuietInFlight = false;
let logsLoadGeneration = 0;

function parseMaybeJsonString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeLevel(value: unknown): LogLevel | null {
  if (typeof value !== "string") {
    return null;
  }
  const lowered = value.toLowerCase() as LogLevel;
  return LEVELS.has(lowered) ? lowered : null;
}

export function parseLogLine(line: string): LogEntry {
  if (!line.trim()) {
    return { raw: line, message: line };
  }
  try {
    const obj = JSON.parse(line) as Record<string, unknown>;
    const meta =
      obj && typeof obj._meta === "object" && obj._meta !== null
        ? (obj._meta as Record<string, unknown>)
        : null;
    const time =
      typeof obj.time === "string" ? obj.time : typeof meta?.date === "string" ? meta?.date : null;
    const level = normalizeLevel(meta?.logLevelName ?? meta?.level);

    const contextCandidate =
      typeof obj["0"] === "string" ? obj["0"] : typeof meta?.name === "string" ? meta?.name : null;
    const contextObj = parseMaybeJsonString(contextCandidate);
    let subsystem: string | null = null;
    if (contextObj) {
      if (typeof contextObj.subsystem === "string") {
        subsystem = contextObj.subsystem;
      } else if (typeof contextObj.module === "string") {
        subsystem = contextObj.module;
      }
    }
    if (!subsystem && contextCandidate && contextCandidate.length < 120) {
      subsystem = contextCandidate;
    }

    let message: string | null = null;
    if (typeof obj["1"] === "string") {
      message = obj["1"];
    } else if (!contextObj && typeof obj["0"] === "string") {
      message = obj["0"];
    } else if (typeof obj.message === "string") {
      message = obj.message;
    }

    return {
      raw: line,
      time,
      level,
      subsystem,
      message: message ?? line,
      meta: meta ?? undefined,
    };
  } catch {
    return { raw: line, message: line };
  }
}

export async function loadLogs(state: LogsState, opts?: { reset?: boolean; quiet?: boolean }) {
  if (!state.client || !state.connected) {
    return;
  }
  const quiet = opts?.quiet === true;
  if (quiet && (logsQuietInFlight || state.logsLoading)) {
    // A quiet tail or a full load is already in flight — skip this tick so
    // overlapping responses cannot regress the cursor or duplicate lines.
    return;
  }
  if (!quiet) {
    state.logsLoading = true;
    // Invalidate any quiet tail still in flight: its stale response must be
    // discarded on return (generation check below).
    if (logsQuietInFlight) {
      logsLoadGeneration += 1;
    }
  }
  const requestGeneration = logsLoadGeneration;
  if (quiet) {
    logsQuietInFlight = true;
  }
  state.logsError = null;
  try {
    const res = await state.client.request("logs.tail", {
      cursor: opts?.reset ? undefined : (state.logsCursor ?? undefined),
      limit: state.logsLimit,
      maxBytes: state.logsMaxBytes,
    });
    if (quiet && logsLoadGeneration !== requestGeneration) {
      // A full load superseded this quiet tail — drop the stale response.
      return;
    }
    const payload = res as {
      file?: string;
      cursor?: number;
      size?: number;
      lines?: unknown;
      truncated?: boolean;
      reset?: boolean;
    };
    const lines = Array.isArray(payload.lines)
      ? payload.lines.filter((line) => typeof line === "string")
      : [];
    const entries = lines.map(parseLogLine);
    const shouldReset = Boolean(opts?.reset || payload.reset || state.logsCursor == null);
    state.logsEntries = shouldReset
      ? entries
      : [...state.logsEntries, ...entries].slice(-LOG_BUFFER_LIMIT);
    if (typeof payload.cursor === "number") {
      state.logsCursor = payload.cursor;
    }
    if (typeof payload.file === "string") {
      state.logsFile = payload.file;
    }
    state.logsTruncated = Boolean(payload.truncated);
    state.logsLastFetchAt = Date.now();
  } catch (err) {
    state.logsError = String(err);
  } finally {
    if (quiet) {
      logsQuietInFlight = false;
    }
    if (!quiet) {
      state.logsLoading = false;
    }
  }
}
