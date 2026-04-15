/**
 * PaleoClaw Tool Registry
 * Inspired by Hermes central registry design.
 */

import {
  RegisteredTool,
  ToolEntry,
  ToolExecuteContext,
  ToolResult,
} from './types.js';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  register(entry: ToolEntry): void {
    const normalizedName = entry.name.trim();
    if (!normalizedName) {
      throw new Error('Tool name must not be empty');
    }

    this.tools.set(normalizedName, {
      ...entry,
      name: normalizedName,
      registeredAt: new Date().toISOString(),
    });
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  list(): RegisteredTool[] {
    return [...this.tools.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async execute(
    name: string,
    params: Record<string, unknown> = {},
    context?: ToolExecuteContext
  ): Promise<ToolResult> {
    const tool = this.get(name);
    const started = Date.now();

    if (!tool) {
      return {
        ok: false,
        tool: name,
        error: `Tool not found: ${name}`,
        elapsedMs: Date.now() - started,
      };
    }

    if (tool.checkAvailability && !tool.checkAvailability()) {
      return {
        ok: false,
        tool: name,
        error: `Tool unavailable: ${name}`,
        elapsedMs: Date.now() - started,
      };
    }

    try {
      const invoke = Promise.resolve(tool.handler(params, context));
      const data = tool.timeoutMs && tool.timeoutMs > 0
        ? await withTimeout(invoke, tool.timeoutMs, `Tool ${name}`)
        : await invoke;

      return {
        ok: true,
        tool: name,
        data,
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      return {
        ok: false,
        tool: name,
        error: error instanceof Error ? error.message : String(error),
        elapsedMs: Date.now() - started,
      };
    }
  }
}

export const toolRegistry = new ToolRegistry();
