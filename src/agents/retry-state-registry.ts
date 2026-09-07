import { TurnRetryStateMachine, TurnRetryState } from './retry-state.js';

export class RetryStateRegistry {
  private static instance: RetryStateRegistry;
  private states = new Map<string, TurnRetryStateMachine>();

  private constructor() {}

  static getInstance(): RetryStateRegistry {
    if (!this.instance) {
      this.instance = new RetryStateRegistry();
    }
    return this.instance;
  }

  getOrCreate(sessionId: string): TurnRetryStateMachine {
    let state = this.states.get(sessionId);
    if (!state) {
      state = new TurnRetryStateMachine();
      this.states.set(sessionId, state);
    }
    return state;
  }

  get(sessionId: string): TurnRetryStateMachine | undefined {
    return this.states.get(sessionId);
  }

  clear(sessionId: string): void {
    this.states.delete(sessionId);
  }

  clearAll(): void {
    this.states.clear();
  }

  getActiveSessions(): string[] {
    return Array.from(this.states.entries())
      .filter(([_, state]) => state.state !== TurnRetryState.Idle)
      .map(([id]) => id);
  }
}

export const retryStateRegistry = RetryStateRegistry.getInstance();
