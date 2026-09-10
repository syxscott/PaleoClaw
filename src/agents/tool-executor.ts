import { toolRegistry } from "../tools/tool-registry.js";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  name: string;
  result: unknown;
  error?: string;
  executionTimeMs: number;
}

export interface ToolExecuteContext {
  sessionId: string;
  userId?: string;
  signal?: AbortSignal;
}

export type ExecutionMode = "concurrent" | "sequential" | "segmented";

export class ToolExecutor {
  private static instance: ToolExecutor;

  static getInstance(): ToolExecutor {
    if (!ToolExecutor.instance) {
      ToolExecutor.instance = new ToolExecutor();
    }
    return ToolExecutor.instance;
  }

  async executeConcurrent(
    toolCalls: ToolCall[],
    context: ToolExecuteContext,
    maxConcurrency: number = 8,
  ): Promise<ToolResult[]> {
    // Preallocate slots so the result order always matches the call order —
    // even with duplicate ids — and un-started calls (e.g. after an abort)
    // still yield a 1:1 call→result mapping like executeSequential.
    const resultByIndex: Array<ToolResult | undefined> = Array.from(
      { length: toolCalls.length },
      () => undefined,
    );
    let index = 0;

    const executeOne = async (call: ToolCall, callIndex: number): Promise<void> => {
      const startTime = Date.now();
      try {
        if (context.signal?.aborted) {
          throw new Error("Execution aborted");
        }

        const tool = toolRegistry.getByName(call.name);
        if (!tool) {
          throw new Error(`Tool not found: ${call.name}`);
        }

        const result = await tool.handler(call.arguments);
        resultByIndex[callIndex] = {
          id: call.id,
          name: call.name,
          result,
          executionTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        resultByIndex[callIndex] = {
          id: call.id,
          name: call.name,
          result: null,
          error: String(error),
          executionTimeMs: Date.now() - startTime,
        };
      }
    };

    const pushTask = (): Promise<void> => {
      if (index >= toolCalls.length) {
        return Promise.resolve();
      }
      const callIndex = index++;
      return executeOne(toolCalls[callIndex], callIndex);
    };

    const workers: Promise<void>[] = [];
    for (let i = 0; i < maxConcurrency; i++) {
      workers.push(
        (async () => {
          while (index < toolCalls.length) {
            if (context.signal?.aborted) {
              break;
            }
            await pushTask();
          }
        })(),
      );
    }

    await Promise.all(workers);

    return resultByIndex.map((result, i) => {
      if (result) {
        return result;
      }
      // The call was never started (worker stopped on abort) — mirror
      // executeSequential's placeholder so callers can map results 1:1.
      return {
        id: toolCalls[i].id,
        name: toolCalls[i].name,
        result: null,
        error: "Execution aborted",
        executionTimeMs: 0,
      };
    });
  }

  async executeSequential(
    toolCalls: ToolCall[],
    context: ToolExecuteContext,
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const call of toolCalls) {
      if (context.signal?.aborted) {
        results.push({
          id: call.id,
          name: call.name,
          result: null,
          error: "Execution aborted",
          executionTimeMs: 0,
        });
        continue;
      }

      const startTime = Date.now();
      try {
        const tool = toolRegistry.getByName(call.name);
        if (!tool) {
          throw new Error(`Tool not found: ${call.name}`);
        }

        const result = await tool.handler(call.arguments);
        results.push({
          id: call.id,
          name: call.name,
          result,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          id: call.id,
          name: call.name,
          result: null,
          error: String(error),
          executionTimeMs: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  async executeSegmented(
    toolCalls: ToolCall[],
    context: ToolExecuteContext,
    segmentSize: number = 5,
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (let i = 0; i < toolCalls.length; i += segmentSize) {
      const segment = toolCalls.slice(i, i + segmentSize);
      const segmentResults = await this.executeConcurrent(segment, context);
      results.push(...segmentResults);
    }

    return results;
  }

  async execute(
    toolCalls: ToolCall[],
    context: ToolExecuteContext,
    mode: ExecutionMode = "sequential",
  ): Promise<ToolResult[]> {
    switch (mode) {
      case "concurrent":
        return this.executeConcurrent(toolCalls, context);
      case "sequential":
        return this.executeSequential(toolCalls, context);
      case "segmented":
        return this.executeSegmented(toolCalls, context);
      default:
        return this.executeSequential(toolCalls, context);
    }
  }
}

export const toolExecutor = ToolExecutor.getInstance();
