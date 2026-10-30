import type { StreamFn } from "@mariozechner/pi-agent-core";
import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import type {
  Api,
  AssistantMessage,
  Context,
  Model,
  SimpleStreamOptions,
} from "@mariozechner/pi-ai";
import type { DiagnosticsStreamWatchdogConfig } from "../../config/types.base.js";
import { parseBooleanValue } from "../../utils/boolean.js";

export const STREAM_WATCHDOG_MIN_TIMEOUT_MS = 1_000;

/**
 * Fresh runs (no prior session history) get a generous idle budget: the first
 * turn usually pays for tool-schema warm-up and cold caches.
 */
export const STREAM_FRESH_WATCHDOG_DEFAULTS = {
  noOutputTimeoutRatio: 0.8,
  minMs: 180_000,
  maxMs: 600_000,
} as const;

/**
 * Resumed runs already have a warm provider cache, so they may interrupt
 * earlier.
 */
export const STREAM_RESUME_WATCHDOG_DEFAULTS = {
  noOutputTimeoutRatio: 0.3,
  minMs: 60_000,
  maxMs: 180_000,
} as const;

/** Default gap between two chunks that is reported as a stall (log only). */
export const STREAM_WATCHDOG_DEFAULT_STALL_TIMEOUT_MS = 30_000;

export type StreamWatchdogProfile = "fresh" | "resume";

export type StreamWatchdogConfig = {
  enabled: boolean;
  /** No event at all for this long → interrupt and retry without streaming. */
  idleTimeoutMs: number;
  /** Gap between two events longer than this → log only, never interrupt. */
  stallTimeoutMs: number;
  /** Fraction of `idleTimeoutMs` at which the idle warning is emitted. */
  warnRatio: number;
  profile: StreamWatchdogProfile;
};

export type StreamWatchdogEnv = {
  /** Master switch. */
  OPENCLAW_STREAM_WATCHDOG?: string;
  /** Explicit idle timeout in milliseconds. */
  OPENCLAW_STREAM_WATCHDOG_IDLE_TIMEOUT_MS?: string;
  /** Explicit stall threshold in milliseconds. */
  OPENCLAW_STREAM_WATCHDOG_STALL_TIMEOUT_MS?: string;
  /** "fresh" (default) or "resume". */
  OPENCLAW_STREAM_WATCHDOG_PROFILE?: string;
};

function parsePositiveInt(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function profileDefaults(profile: StreamWatchdogProfile) {
  return profile === "resume" ? STREAM_RESUME_WATCHDOG_DEFAULTS : STREAM_FRESH_WATCHDOG_DEFAULTS;
}

/**
 * Resolve the watchdog configuration.
 *
 * The watchdog is **off by default**: it only becomes active when
 * `OPENCLAW_STREAM_WATCHDOG` is truthy, or when one of the timeout variables
 * is set explicitly. Existing deployments therefore behave exactly as before.
 */
export function resolveStreamWatchdogConfig(params: {
  env?: NodeJS.ProcessEnv;
  runTimeoutMs?: number;
  profile?: StreamWatchdogProfile;
  /** `diagnostics.streamWatchdog` from the config file; takes precedence over env. */
  config?: DiagnosticsStreamWatchdogConfig;
}): StreamWatchdogConfig {
  const env = (params.env ?? process.env) as StreamWatchdogEnv;
  const cfg = params.config;
  const profile: StreamWatchdogProfile =
    params.profile ??
    (cfg?.profile === "resume" || cfg?.profile === "fresh"
      ? cfg.profile
      : env.OPENCLAW_STREAM_WATCHDOG_PROFILE === "resume"
        ? "resume"
        : "fresh");
  const defaults = profileDefaults(profile);

  const explicitIdle =
    (typeof cfg?.idleTimeoutMs === "number" && cfg.idleTimeoutMs > 0
      ? cfg.idleTimeoutMs
      : undefined) ?? parsePositiveInt(env.OPENCLAW_STREAM_WATCHDOG_IDLE_TIMEOUT_MS);
  const explicitStall =
    (typeof cfg?.stallTimeoutMs === "number" && cfg.stallTimeoutMs > 0
      ? cfg.stallTimeoutMs
      : undefined) ?? parsePositiveInt(env.OPENCLAW_STREAM_WATCHDOG_STALL_TIMEOUT_MS);
  const flag = cfg?.enabled ?? parseBooleanValue(env.OPENCLAW_STREAM_WATCHDOG);
  const enabled = flag ?? (explicitIdle !== undefined || explicitStall !== undefined);

  const derivedIdle = params.runTimeoutMs
    ? clamp(defaults.noOutputTimeoutRatio * params.runTimeoutMs, defaults.minMs, defaults.maxMs)
    : defaults.maxMs;

  return {
    enabled,
    idleTimeoutMs: explicitIdle ?? Math.max(STREAM_WATCHDOG_MIN_TIMEOUT_MS, derivedIdle),
    stallTimeoutMs: explicitStall ?? STREAM_WATCHDOG_DEFAULT_STALL_TIMEOUT_MS,
    warnRatio: 0.5,
    profile,
  };
}

export type StreamWatchdogLog = (
  level: "warn" | "info" | "debug",
  message: string,
  data?: Record<string, unknown>,
) => void;

export type StreamWatchdogFallback = (
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
) => Promise<AssistantMessage>;

/**
 * Minimal event stream with the same contract as pi-ai's
 * `AssistantMessageEventStream`: the consumer iterates the events and awaits
 * `result()` for the final message.
 */
function buildErrorMessage(model: Model<Api>, error: unknown): AssistantMessage {
  const message = error instanceof Error ? error.message : String(error);
  return {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "error",
    errorMessage: message,
    timestamp: Date.now(),
  };
}

function unrefTimer(timer: ReturnType<typeof setTimeout>): void {
  const candidate = timer as unknown as { unref?: () => void };
  if (typeof candidate.unref === "function") {
    candidate.unref();
  }
}

/**
 * Default non-streaming fallback.
 *
 * `completeSimple` is imported lazily so that this module never pulls a value
 * import out of `@mariozechner/pi-ai` at load time.
 */
const defaultFallback: StreamWatchdogFallback = async (model, context, streamOptions) => {
  const { completeSimple } = await import("@mariozechner/pi-ai");
  return completeSimple(model, context, streamOptions);
};

export type StreamWatchdogWrapperOptions = {
  env?: NodeJS.ProcessEnv;
  /** `diagnostics.streamWatchdog` from the config file; takes precedence over env. */
  config?: DiagnosticsStreamWatchdogConfig;
  /** Total budget of the run; used to derive the idle timeout from the ratio. */
  runTimeoutMs?: number;
  /** "auto" derives the profile from the request (first turn = fresh). */
  profile?: StreamWatchdogProfile | "auto";
  log?: StreamWatchdogLog;
  /** Override for the non-streaming fallback (tests). */
  fallback?: StreamWatchdogFallback;
};

/**
 * Wrap the embedded agent stream function with a dual watchdog.
 *
 * - **Idle**: no event at all for `idleTimeoutMs` → the in-flight request is
 *   aborted through its `AbortSignal` and the turn is retried without
 *   streaming. A warning is emitted at half the threshold.
 * - **Stall**: the gap between two received chunks exceeds `stallTimeoutMs` →
 *   logged only. The model may simply be thinking, so the stream is left
 *   alone.
 *
 * The fallback only runs when the watchdog fired *before* the first content
 * event: nothing was produced yet, so retrying cannot duplicate output and
 * cannot double-charge the user for a second copy of the same answer. Once the
 * model has streamed something, a stall is only logged.
 */
export function createStreamWatchdogWrapper(
  options: StreamWatchdogWrapperOptions = {},
): (streamFn: StreamFn) => StreamFn {
  const log = options.log;
  const fallback: StreamWatchdogFallback = options.fallback ?? defaultFallback;

  return (streamFn: StreamFn): StreamFn => {
    const wrapped: StreamFn = (model, context, streamOptions) => {
      const profile: StreamWatchdogProfile =
        options.profile && options.profile !== "auto"
          ? options.profile
          : (context.messages?.length ?? 0) <= 1
            ? "fresh"
            : "resume";
      const config = resolveStreamWatchdogConfig({
        env: options.env,
        config: options.config,
        runTimeoutMs: options.runTimeoutMs,
        profile,
      });
      if (!config.enabled) {
        return streamFn(model, context, streamOptions);
      }

      const controller = new AbortController();
      const externalSignal = streamOptions?.signal;
      const forwardAbort = () => {
        controller.abort(externalSignal?.reason);
      };
      if (externalSignal) {
        if (externalSignal.aborted) {
          controller.abort(externalSignal.reason);
        } else {
          externalSignal.addEventListener("abort", forwardAbort, { once: true });
        }
      }

      const out = createAssistantMessageEventStream();
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      let warnTimer: ReturnType<typeof setTimeout> | undefined;
      let stallTimer: ReturnType<typeof setTimeout> | undefined;
      let sawActivity = false;
      let idleFired = false;
      let settled = false;

      const clearTimers = () => {
        if (idleTimer) {
          clearTimeout(idleTimer);
        }
        if (warnTimer) {
          clearTimeout(warnTimer);
        }
        if (stallTimer) {
          clearTimeout(stallTimer);
        }
        idleTimer = undefined;
        warnTimer = undefined;
        stallTimer = undefined;
      };

      const cleanup = () => {
        clearTimers();
        externalSignal?.removeEventListener("abort", forwardAbort);
      };

      const finish = (message: AssistantMessage) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        out.end(message);
      };

      const armStall = () => {
        if (stallTimer) {
          clearTimeout(stallTimer);
        }
        stallTimer = setTimeout(() => {
          stallTimer = undefined;
          log?.("warn", "embedded stream stall detected; continuing without interruption", {
            stallTimeoutMs: config.stallTimeoutMs,
            profile: config.profile,
          });
        }, config.stallTimeoutMs);
        unrefTimer(stallTimer);
      };

      const markActivity = () => {
        sawActivity = true;
        if (idleTimer) {
          clearTimeout(idleTimer);
        }
        if (warnTimer) {
          clearTimeout(warnTimer);
        }
        idleTimer = undefined;
        warnTimer = undefined;
        armStall();
      };

      const runFallback = async () => {
        try {
          const message = await fallback(model, context, {
            ...streamOptions,
            signal: externalSignal,
          });
          if (settled) {
            return;
          }
          if (
            message.stopReason === "stop" ||
            message.stopReason === "length" ||
            message.stopReason === "toolUse"
          ) {
            out.push({ type: "done", reason: message.stopReason, message });
            finish(message);
            return;
          }
          out.push({ type: "error", reason: "error", error: message });
          finish(message);
        } catch (error) {
          if (settled) {
            return;
          }
          const errorMessage = buildErrorMessage(model, error);
          out.push({ type: "error", reason: "error", error: errorMessage });
          finish(errorMessage);
        }
      };

      const onIdleTimeout = () => {
        if (settled || idleFired || sawActivity) {
          return;
        }
        idleFired = true;
        log?.("warn", "embedded stream idle watchdog fired; retrying without streaming", {
          idleTimeoutMs: config.idleTimeoutMs,
          profile: config.profile,
        });
        try {
          controller.abort(new Error("embedded stream idle watchdog timeout"));
        } catch {
          // AbortController.abort() does not throw for a plain reason.
        }
        void runFallback();
      };

      idleTimer = setTimeout(onIdleTimeout, config.idleTimeoutMs);
      unrefTimer(idleTimer);
      warnTimer = setTimeout(
        () => {
          warnTimer = undefined;
          if (settled || idleFired || sawActivity) {
            return;
          }
          log?.("warn", "embedded stream idle watchdog warning", {
            idleTimeoutMs: config.idleTimeoutMs,
            profile: config.profile,
          });
        },
        Math.max(1, Math.round(config.idleTimeoutMs * config.warnRatio)),
      );
      unrefTimer(warnTimer);

      let inner: ReturnType<StreamFn>;
      try {
        inner = streamFn(model, context, { ...streamOptions, signal: controller.signal });
      } catch (error) {
        cleanup();
        const errorMessage = buildErrorMessage(model, error);
        out.push({ type: "error", reason: "error", error: errorMessage });
        out.end(errorMessage);
        return out;
      }

      const forward = async () => {
        try {
          const stream = await inner;
          for await (const event of stream) {
            if (idleFired) {
              // The fallback owns the outcome; drop the aborted stream events.
              continue;
            }
            if (event.type !== "start") {
              markActivity();
            }
            out.push(event);
            if (event.type === "done") {
              finish(event.message);
              return;
            }
            if (event.type === "error") {
              finish(event.error);
              return;
            }
          }
          if (idleFired) {
            return;
          }
          const result = await stream.result();
          finish(result);
        } catch (error) {
          if (idleFired) {
            return;
          }
          const errorMessage = buildErrorMessage(model, error);
          out.push({ type: "error", reason: "error", error: errorMessage });
          finish(errorMessage);
        }
      };

      void forward().catch(() => undefined);

      return out;
    };
    return wrapped;
  };
}
