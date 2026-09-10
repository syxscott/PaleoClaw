import { ToolEntry, ToolSetEntry, ToolJsonSchema } from "./registry-types.js";
import { ToolAvailabilityCache } from "./tool-availability-cache.js";

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools = new Map<string, ToolEntry>();
  private toolsets = new Map<string, ToolSetEntry>();
  private generation = 0;
  private readonly availabilityCache = new ToolAvailabilityCache();

  private constructor() {}

  static getInstance(): ToolRegistry {
    if (!this.instance) {
      this.instance = new ToolRegistry();
    }
    return this.instance;
  }

  register(entry: ToolEntry, override?: boolean): boolean {
    const existing = this.tools.get(entry.name);
    if (existing && !override) {
      console.warn(`Tool ${entry.name} already registered, skipping`);
      return false;
    }

    this.tools.set(entry.name, entry);
    this.generation++;
    this.availabilityCache.invalidate(entry.name);
    return true;
  }

  registerToolset(entry: ToolSetEntry): void {
    this.toolsets.set(entry.name, entry);
    this.generation++;
  }

  getByName(name: string): ToolEntry | undefined {
    return this.tools.get(name);
  }

  getByToolset(toolset: string): ToolEntry[] {
    return Array.from(this.tools.values()).filter((t) => t.toolset === toolset);
  }

  getAllTools(): ToolEntry[] {
    return Array.from(this.tools.values());
  }

  getToolset(name: string): ToolSetEntry | undefined {
    return this.toolsets.get(name);
  }

  getAllToolsets(): ToolSetEntry[] {
    return Array.from(this.toolsets.values());
  }

  async isAvailable(name: string): Promise<boolean> {
    const tool = this.tools.get(name);
    if (!tool) {
      return false;
    }
    if (!tool.checkFn) {
      return true;
    }
    return this.availabilityCache.check(name, tool.checkFn);
  }

  getGeneration(): number {
    return this.generation;
  }

  getDefinitions(): Array<{
    name: string;
    description?: string;
    schema: ToolJsonSchema;
    emoji?: string;
  }> {
    return this.getAllTools().map((t) => ({
      name: t.name,
      description: t.description,
      schema: t.schema,
      emoji: t.emoji,
    }));
  }

  clear(): void {
    this.tools.clear();
    this.toolsets.clear();
    this.generation++;
    this.availabilityCache.invalidateAll();
  }
}

export const toolRegistry = ToolRegistry.getInstance();
