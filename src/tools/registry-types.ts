export interface ToolJsonSchema {
  type: string;
  properties: Record<string, unknown>;
  required?: string[];
  description?: string;
}

export interface ToolEntry {
  name: string;
  toolset: string;
  schema: ToolJsonSchema;
  handler: ToolHandler;
  checkFn?: () => boolean | Promise<boolean>;
  requiresEnv?: string[];
  isAsync?: boolean;
  description?: string;
  emoji?: string;
  maxResultSizeChars?: number;
  dynamicSchemaOverrides?: () => Record<string, unknown>;
}

export interface ToolSetEntry {
  name: string;
  description: string;
  tools: string[];
  includes?: string[];
  checkFn?: () => boolean | Promise<boolean>;
}

export type ToolHandler = (args: Record<string, unknown>) => unknown;
