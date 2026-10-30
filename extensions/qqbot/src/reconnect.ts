/**
 * Reconnect / backoff state machine for the QQ WebSocket gateway.
 *
 * Mirrors the repo's Slack monitor pattern (attempt counter + escalating
 * computeBackoff ladder + max-attempts bail) with the QQ-specific close-code
 * classification from the Python reference (`_FATAL_CLOSE_CODES`,
 * `_SESSION_INVALID_CLOSE_CODES`, 4004 invalid token, 4008 rate limited).
 */

import {
  QQ_CLOSE_INVALID_TOKEN,
  QQ_CLOSE_RATE_LIMITED,
  QQ_FATAL_CLOSE_CODES,
  QQ_MAX_RECONNECT_ATTEMPTS,
  QQ_RATE_LIMIT_DELAY_MS,
  QQ_RECONNECT_BACKOFF_MS,
  isSessionInvalidCloseCode,
} from "./constants.js";

export type QqbotReconnectState = "idle" | "connected" | "backoff" | "stopped" | "fatal";

export type QqbotReconnectDecision =
  | { kind: "retry"; delayMs: number; attempt: number }
  | { kind: "give-up"; attempt: number }
  | { kind: "fatal"; reason: string }
  | { kind: "stopped" };

export type QqbotCloseClassification =
  | { kind: "fatal"; reason: string }
  | { kind: "rate-limit" }
  | { kind: "invalid-token" }
  | { kind: "session-invalid" }
  | { kind: "retry" };

/** Classify a WebSocket close code (reference _listen_loop close handling). */
export function classifyQqbotCloseCode(code: number | undefined): QqbotCloseClassification {
  if (code !== undefined) {
    const fatal = QQ_FATAL_CLOSE_CODES[code];
    if (fatal) {
      return { kind: "fatal", reason: fatal };
    }
    if (code === QQ_CLOSE_RATE_LIMITED) {
      return { kind: "rate-limit" };
    }
    if (code === QQ_CLOSE_INVALID_TOKEN) {
      return { kind: "invalid-token" };
    }
    if (isSessionInvalidCloseCode(code)) {
      return { kind: "session-invalid" };
    }
  }
  return { kind: "retry" };
}

export type QqbotReconnectPolicyOptions = {
  backoffMs?: readonly number[];
  maxAttempts?: number;
  /** Overrides the extra fixed delay applied to rate-limit closes. */
  rateLimitDelayMs?: number;
};

export class QqbotReconnectPolicy {
  state: QqbotReconnectState = "idle";
  attempt = 0;

  private readonly backoffMs: readonly number[];
  private readonly maxAttempts: number;
  private readonly rateLimitDelayMs: number;
  private lastDelayMs = 0;
  private fatalReason: string | null = null;

  constructor(options?: QqbotReconnectPolicyOptions) {
    this.backoffMs = options?.backoffMs ?? QQ_RECONNECT_BACKOFF_MS;
    this.maxAttempts = options?.maxAttempts ?? QQ_MAX_RECONNECT_ATTEMPTS;
    this.rateLimitDelayMs = options?.rateLimitDelayMs ?? QQ_RATE_LIMIT_DELAY_MS;
  }

  get lastDelay(): number {
    return this.lastDelayMs;
  }

  /** Ladder with clamp on the last rung: 2s, 5s, 10s, 30s, 60s, 60s, ... */
  delayForAttempt(attempt: number): number {
    const index = Math.min(Math.max(attempt - 1, 0), this.backoffMs.length - 1);
    return this.backoffMs[index] ?? this.backoffMs[this.backoffMs.length - 1] ?? 60_000;
  }

  /** Transport is up — reset the attempt counter. */
  onConnected(): void {
    this.state = "connected";
    this.attempt = 0;
    this.lastDelayMs = 0;
  }

  /**
   * Transport failed. Returns the decision the gateway loop must apply:
   * retry (after delayMs), give-up (max attempts), fatal (unrecoverable close),
   * or stopped (policy was stopped). `close` classifies the WS close code.
   */
  onFailure(close?: QqbotCloseClassification): QqbotReconnectDecision {
    if (this.state === "stopped") {
      return { kind: "stopped" };
    }
    if (close?.kind === "fatal") {
      this.state = "fatal";
      this.fatalReason = close.reason;
      return { kind: "fatal", reason: close.reason };
    }
    if (this.state === "fatal") {
      return { kind: "fatal", reason: this.fatalReason ?? "fatal close code" };
    }
    this.attempt += 1;
    if (this.maxAttempts > 0 && this.attempt > this.maxAttempts) {
      this.state = "stopped";
      return { kind: "give-up", attempt: this.attempt };
    }
    const delayMs =
      close?.kind === "rate-limit"
        ? Math.max(this.rateLimitDelayMs, this.delayForAttempt(this.attempt))
        : this.delayForAttempt(this.attempt);
    this.lastDelayMs = delayMs;
    this.state = "backoff";
    return { kind: "retry", delayMs, attempt: this.attempt };
  }

  /** Explicit stop (shutdown or abort signal) — never retries afterwards. */
  stop(): void {
    this.state = "stopped";
  }
}
