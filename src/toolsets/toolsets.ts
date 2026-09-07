import { toolRegistry } from '../tools/tool-registry.js';

export interface ToolsetDefinition {
  name: string;
  description: string;
  tools: string[];
  includes?: string[];
}

export const CORE_TOOLSETS: Record<string, ToolsetDefinition> = {
  'hermes-core': {
    name: 'hermes-core',
    description: 'Core Hermes tools',
    tools: ['web_search', 'web_extract', 'terminal', 'process', 'read_file', 'write_file'],
  },
  'file': {
    name: 'file',
    description: 'File operations',
    tools: ['read_file', 'write_file', 'patch', 'search_files'],
  },
  'web': {
    name: 'web',
    description: 'Web search and extraction',
    tools: ['web_search', 'web_extract'],
  },
  'terminal': {
    name: 'terminal',
    description: 'Terminal and process operations',
    tools: ['terminal', 'process'],
  },
  'vision': {
    name: 'vision',
    description: 'Vision and image analysis',
    tools: ['vision_analyze', 'image_generate'],
  },
};

export class ToolsetResolver {
  private static seenCycles = new Set<string>();

  static resolve(name: string, visited = new Set<string>()): string[] {
    if (visited.has(name)) {
      console.warn(`Toolset cycle detected: ${name}`);
      return [];
    }

    const toolset = CORE_TOOLSETS[name] || toolRegistry.getToolset(name);
    if (!toolset) {
      console.warn(`Toolset not found: ${name}`);
      return [];
    }

    visited.add(name);
    const tools: string[] = [...toolset.tools];

    if (toolset.includes) {
      for (const included of toolset.includes) {
        const includedTools = this.resolve(included, new Set(visited));
        tools.push(...includedTools);
      }
    }

    return [...new Set(tools)]; // Dedupe
  }

  static getAllToolsets(): ToolsetDefinition[] {
    const core = Object.values(CORE_TOOLSETS);
    const registered = toolRegistry.getAllToolsets();
    return [...core, ...registered];
  }
}
