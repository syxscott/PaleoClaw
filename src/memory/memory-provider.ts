export interface MemoryProviderStats {
  name: string;
  available: boolean;
  memoryCount?: number;
  lastSync?: Date;
}

export abstract class MemoryProvider {
  abstract readonly name: string;

  abstract is_available(): boolean;
  abstract initialize(session_id: string, ...kwargs: unknown[]): void;

  system_prompt_block(): string {
    return "";
  }

  prefetch(_query: string, _session_id: string = ""): string {
    return "";
  }

  queue_prefetch(_query: string, _session_id: string = ""): void {
    // Default no-op
  }

  sync_turn(_user_content: string, _assistant_content: string, ..._kwargs: unknown[]): void {
    // Default no-op
  }

  on_turn_start(): void {}
  on_session_end(): void {}
  on_session_switch(_session_id: string): void {}
  on_pre_compress(messages: unknown[]): unknown[] {
    return messages;
  }

  abstract get_tool_schemas(): Array<{ name: string; description: string; input_schema: unknown }>;

  handle_tool_call(_tool_name: string, _args: Record<string, unknown>, _result: unknown): string {
    return "";
  }

  get_stats(): MemoryProviderStats {
    return {
      name: this.name,
      available: this.is_available(),
    };
  }
}
