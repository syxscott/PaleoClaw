export interface ContextEngineStats {
  lastPromptTokens: number;
  lastCompletionTokens: number;
  lastTotalTokens: number;
  thresholdTokens: number;
  contextLength: number;
  compressionCount: number;
}

export abstract class ContextEngine {
  name: string = 'unknown';
  lastPromptTokens: number = 0;
  lastCompletionTokens: number = 0;
  lastTotalTokens: number = 0;
  thresholdTokens: number = 0;
  contextLength: number = 0;
  compressionCount: number = 0;
  thresholdPercent: number = 0.9;
  protectFirstN: number = 2;
  protectLastN: number = 5;

  abstract update_from_response(response: unknown): void;
  abstract should_compress(): boolean;
  abstract compress(messages: Array<{ role: string; content: string }>): Array<{ role: string; content: string }>;

  on_session_start(): void {
    this.compressionCount = 0;
    this.lastPromptTokens = 0;
    this.lastCompletionTokens = 0;
    this.lastTotalTokens = 0;
  }

  on_session_end(): void {}
  on_session_reset(): void { this.on_session_start(); }

  get_tool_schemas(): Array<{ name: string; description: string; input_schema: unknown }> { return []; }
  handle_tool_call(_tool_name: string, _args: Record<string, unknown>, _result: unknown): string { return ''; }

  get_status(): ContextEngineStats {
    return {
      lastPromptTokens: this.lastPromptTokens,
      lastCompletionTokens: this.lastCompletionTokens,
      lastTotalTokens: this.lastTotalTokens,
      thresholdTokens: this.thresholdTokens,
      contextLength: this.contextLength,
      compressionCount: this.compressionCount,
    };
  }
}
