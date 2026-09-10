import { ContextCompressor } from "./context-engine-compressor.js";
import { ContextEngine } from "./context-engine.js";

export class ContextEngineRegistry {
  private static instance: ContextEngineRegistry;
  private engines = new Map<string, ContextEngine>();
  private defaultEngine: ContextEngine;

  private constructor() {
    this.defaultEngine = new ContextCompressor();
    this.engines.set("context-compressor", this.defaultEngine);
  }

  static getInstance(): ContextEngineRegistry {
    if (!this.instance) {
      this.instance = new ContextEngineRegistry();
    }
    return this.instance;
  }

  register(name: string, engine: ContextEngine): void {
    this.engines.set(name, engine);
  }

  get(name: string): ContextEngine {
    return this.engines.get(name) || this.defaultEngine;
  }

  getDefault(): ContextEngine {
    return this.defaultEngine;
  }

  list(): Array<{ name: string; stats: ReturnType<ContextEngine["get_status"]> }> {
    return Array.from(this.engines.entries()).map(([name, engine]) => ({
      name,
      stats: engine.get_status(),
    }));
  }
}

export const contextEngineRegistry = ContextEngineRegistry.getInstance();
