export enum FailoverReason {
  RateLimit = 'rate_limit',
  ContextTooLong = 'context_too_long',
  Auth = 'auth',
  AuthPermanent = 'auth_permanent',
  Billing = 'billing',
  TokenLimit = 'token_limit',
  Timeout = 'timeout',
  InternalError = 'internal_error',
  Unknown = 'unknown',
}

export enum TurnRetryState {
  Idle = 'idle',
  Retrying = 'retrying',
  Exhausted = 'exhausted',
}

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: Record<FailoverReason, RetryConfig> = {
  [FailoverReason.RateLimit]: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000 },
  [FailoverReason.ContextTooLong]: { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 5000 },
  [FailoverReason.Auth]: { maxRetries: 2, baseDelayMs: 1000, maxDelayMs: 10000 },
  [FailoverReason.AuthPermanent]: { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0 },
  [FailoverReason.Billing]: { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0 },
  [FailoverReason.TokenLimit]: { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 5000 },
  [FailoverReason.Timeout]: { maxRetries: 3, baseDelayMs: 2000, maxDelayMs: 60000 },
  [FailoverReason.InternalError]: { maxRetries: 2, baseDelayMs: 1000, maxDelayMs: 15000 },
  [FailoverReason.Unknown]: { maxRetries: 1, baseDelayMs: 1000, maxDelayMs: 5000 },
};

export class TurnRetryStateMachine {
  state: TurnRetryState = TurnRetryState.Idle;
  attemptCount: number = 0;
  lastFailoverReason?: FailoverReason;
  lastAttemptAt?: Date;
  errors: Array<{ reason: FailoverReason; at: Date; message: string }> = [];

  get currentReason(): FailoverReason | undefined {
    return this.lastFailoverReason;
  }

  get shouldRetry(): boolean {
    if (this.state === TurnRetryState.Exhausted) return false;
    if (!this.lastFailoverReason) return false;

    const config = DEFAULT_RETRY_CONFIG[this.lastFailoverReason];
    return this.attemptCount < config.maxRetries;
  }

  get retryDelayMs(): number {
    if (!this.lastFailoverReason) return 0;
    const config = DEFAULT_RETRY_CONFIG[this.lastFailoverReason];
    const delay = config.baseDelayMs * Math.pow(2, this.attemptCount);
    return Math.min(delay, config.maxDelayMs);
  }

  recordFailure(reason: FailoverReason, errorMessage?: string): void {
    this.state = TurnRetryState.Retrying;
    this.attemptCount++;
    this.lastFailoverReason = reason;
    this.lastAttemptAt = new Date();
    this.errors.push({
      reason,
      at: new Date(),
      message: errorMessage || 'Unknown error',
    });

    const config = DEFAULT_RETRY_CONFIG[reason];
    if (this.attemptCount >= config.maxRetries) {
      this.state = TurnRetryState.Exhausted;
    }
  }

  recordSuccess(): void {
    this.reset();
  }

  reset(): void {
    this.state = TurnRetryState.Idle;
    this.attemptCount = 0;
    this.lastFailoverReason = undefined;
    this.lastAttemptAt = undefined;
    this.errors = [];
  }

  getStatus(): {
    state: TurnRetryState;
    attemptCount: number;
    lastReason?: FailoverReason;
    shouldRetry: boolean;
    retryDelayMs: number;
    errorCount: number;
  } {
    return {
      state: this.state,
      attemptCount: this.attemptCount,
      lastReason: this.lastFailoverReason,
      shouldRetry: this.shouldRetry,
      retryDelayMs: this.retryDelayMs,
      errorCount: this.errors.length,
    };
  }

  static reasonFromError(error: any): FailoverReason {
    if (!error) return FailoverReason.Unknown;

    const message = String(error.message || error).toLowerCase();

    if (message.includes('rate_limit') || message.includes('429')) {
      return FailoverReason.RateLimit;
    }
    if (message.includes('context') && (message.includes('too_long') || message.includes('exceed'))) {
      return FailoverReason.ContextTooLong;
    }
    if (message.includes('token') && (message.includes('limit') || message.includes('exceed'))) {
      return FailoverReason.TokenLimit;
    }
    if (message.includes('auth') || message.includes('401') || message.includes('403')) {
      return message.includes('permanent') ? FailoverReason.AuthPermanent : FailoverReason.Auth;
    }
    if (message.includes('billing') || message.includes('payment')) {
      return FailoverReason.Billing;
    }
    if (message.includes('timeout') || message.includes('timed_out')) {
      return FailoverReason.Timeout;
    }
    if (message.includes('internal') || message.includes('500')) {
      return FailoverReason.InternalError;
    }

    return FailoverReason.Unknown;
  }
}
