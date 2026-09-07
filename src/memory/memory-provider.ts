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
    return '';
  }

  prefetch(query: string, session_id: string = ''): string {
    return '';
  }

  queue_prefetch(query: string, session_id: string = ''): void {
    // Default no-op
  }

  sync_turn(user_content: string, assistant_content: string, ...kwargs: unknown[]): void {
    // Default no-op
  }

  on_turn_start(): void {}
  on_session_end(): void {}
  on_session_switch(session_id: string): void {}
  on_pre_compress(messages: unknown[]): unknown[] {
    return messages;
  }

  abstract get_tool_schemas(): Array<{ name: string; description: string; input_schema: unknown }>;

  handle_tool_call(tool_name: string, args: Record<string, unknown>, result: unknown): string {
    return '';
  }

  get_stats(): MemoryProviderStats {
    return {
      name: this.name,
      available: this.is_available(),
    };
  }
}
