/**
 * PaleoClaw Tool System types
 */

export type ToolCategory =
  | 'research'
  | 'database'
  | 'analysis'
  | 'morphometric'
  | 'utility';

export interface ToolJsonSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

export interface ToolExecuteContext {
  cwd?: string;
  sessionId?: string;
  userId?: string;
  signal?: AbortSignal;
}

export interface ToolResult {
  ok: boolean;
  tool: string;
  data?: unknown;
  error?: string;
  elapsedMs: number;
}

export type ToolHandler = (
  params: Record<string, unknown>,
  context?: ToolExecuteContext
) => Promise<unknown> | unknown;

export interface ToolEntry {
  name: string;
  category: ToolCategory;
  description: string;
  schema: ToolJsonSchema;
  handler: ToolHandler;
  checkAvailability?: () => boolean;
  timeoutMs?: number;
}

export interface RegisteredTool extends ToolEntry {
  registeredAt: string;
}
