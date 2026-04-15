/**
 * PaleoClaw Tools CLI
 */

import { discoverTools } from '../tools/loader.js';
import { toolRegistry } from '../tools/registry.js';

interface ToolCommandOptions {
  json?: boolean;
  params?: string;
}

function parseParams(raw?: string): Record<string, unknown> {
  if (!raw || !raw.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error('params must be a JSON object');
  } catch (error) {
    throw new Error(`Invalid --params JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function registerToolsCommands(program: any): void {
  const toolsCmd = program
    .command('paleo-tools')
    .alias('ptools')
    .description('Manage and run PaleoClaw built-in tools');

  toolsCmd
    .command('list')
    .description('List available tools')
    .option('--json', 'Output as JSON')
    .action(async (options: ToolCommandOptions) => {
      try {
        const tools = await discoverTools();
        if (options.json) {
          console.log(JSON.stringify(tools, null, 2));
          return;
        }

        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║                 PaleoClaw Tool Catalog                     ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');
        for (const tool of tools) {
          console.log(`• ${tool.name} [${tool.category}]`);
          console.log(`  ${tool.description}`);
        }
      } catch (error) {
        console.error('Error listing tools:', error);
        process.exit(1);
      }
    });

  toolsCmd
    .command('run')
    .description('Run a tool by name')
    .argument('<tool-name>', 'Tool name to execute')
    .option('--params <json>', 'JSON object of tool params')
    .option('--json', 'Output as JSON')
    .action(async (toolName: string, options: ToolCommandOptions) => {
      try {
        await discoverTools();
        const params = parseParams(options.params);
        const result = await toolRegistry.execute(toolName, params);

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          process.exit(result.ok ? 0 : 1);
          return;
        }

        if (result.ok) {
          console.log(`✓ Tool succeeded: ${toolName} (${result.elapsedMs}ms)`);
          console.log(JSON.stringify(result.data, null, 2));
          return;
        }

        console.error(`✗ Tool failed: ${toolName} (${result.elapsedMs}ms)`);
        console.error(result.error || 'Unknown tool error');
        process.exit(1);
      } catch (error) {
        console.error('Error running tool:', error);
        process.exit(1);
      }
    });
}
