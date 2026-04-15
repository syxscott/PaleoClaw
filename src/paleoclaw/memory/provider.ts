/**
 * Memory provider abstractions for PaleoClaw
 */

export interface MemoryProvider {
  name: string;
  isBuiltin?: boolean;

  buildSystemPrompt?(): string;
  prefetch?(userMessage: string): Promise<string> | string;
  sync?(userMessage: string, assistantResponse: string): Promise<void> | void;
}
