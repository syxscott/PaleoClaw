import { MemoryProvider, MemoryProviderStats } from './memory-provider.js';
import { build_memory_context_block } from './memory-context-fence.js';

export class MemoryManager {
  private static instance: MemoryManager;
  private providers: Map<string, MemoryProvider> = new Map();
  private externalProviderCount = 0;
  private externalProviderNames: Set<string> = new Set();
  private currentSessionId: string = '';

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  add_provider(provider: MemoryProvider, is_external: boolean = false): boolean {
    if (is_external && this.externalProviderCount >= 1) {
      console.warn('MemoryManager: Maximum external providers (1) reached. Rejecting:', provider.name);
      return false;
    }

    if (this.providers.has(provider.name)) {
      console.warn('MemoryManager: Provider already registered:', provider.name);
      return false;
    }

    this.providers.set(provider.name, provider);
    if (is_external) {
      this.externalProviderCount++;
      this.externalProviderNames.add(provider.name);
    }
    return true;
  }

  remove_provider(name: string): boolean {
    const provider = this.providers.get(name);
    if (!provider) return false;
    this.providers.delete(name);
    if (this.externalProviderNames.delete(name)) {
      this.externalProviderCount--;
    }
    return true;
  }

  get_provider(name: string): MemoryProvider | undefined {
    return this.providers.get(name);
  }

  getAllProviders(): MemoryProvider[] {
    return Array.from(this.providers.values());
  }

  initialize(session_id: string): void {
    this.currentSessionId = session_id;
    for (const provider of this.providers.values()) {
      provider.initialize(session_id);
    }
  }

  build_system_prompt(): string {
    const blocks: string[] = [];
    for (const provider of this.providers.values()) {
      const block = provider.system_prompt_block();
      if (block) blocks.push(block);
    }
    return blocks.join('\n\n');
  }

  prefetch_all(query: string): string {
    const contexts: string[] = [];
    for (const provider of this.providers.values()) {
      const context = provider.prefetch(query, this.currentSessionId);
      if (context) contexts.push(context);
    }
    return contexts.join('\n\n');
  }

  queue_prefetch_all(query: string): void {
    for (const provider of this.providers.values()) {
      provider.queue_prefetch(query, this.currentSessionId);
    }
  }

  sync_all(user_content: string, assistant_content: string): void {
    for (const provider of this.providers.values()) {
      provider.sync_turn(user_content, assistant_content);
    }
  }

  on_turn_start(): void {
    for (const provider of this.providers.values()) {
      provider.on_turn_start();
    }
  }

  on_session_end(): void {
    for (const provider of this.providers.values()) {
      provider.on_session_end();
    }
  }

  on_session_switch(session_id: string): void {
    this.currentSessionId = session_id;
    for (const provider of this.providers.values()) {
      provider.on_session_switch(session_id);
    }
  }

  getAllToolSchemas(): Array<{ name: string; description: string; input_schema: unknown }> {
    const schemas: Array<{ name: string; description: string; input_schema: unknown }> = [];
    for (const provider of this.providers.values()) {
      schemas.push(...provider.get_tool_schemas());
    }
    return schemas;
  }

  get_stats(): MemoryProviderStats[] {
    return Array.from(this.providers.values(), (p) => p.get_stats());
  }

  clear(): void {
    this.providers.clear();
    this.externalProviderCount = 0;
    this.externalProviderNames.clear();
  }
}

export const memoryManager = MemoryManager.getInstance();
