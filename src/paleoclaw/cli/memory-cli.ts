/**
 * PaleoClaw Memory CLI
 * Commands: status, short, long, archive, search, review
 */

import { TaskMemoryStore } from '../memory/store.js';
import { loadSessionProfile } from '../profile/layers.js';

interface MemoryCommandOptions {
  limit?: string;
  status?: string;
  beforeDays?: string;
  scope?: string;
  topK?: string;
  minScore?: string;
  json?: boolean;
  taskId?: string;
  summary?: string;
  includeRunning?: boolean;
}

export function registerMemoryCommands(program: any): void {
  const memoryCmd = program
    .command('paleo-memory')
    .alias('pmem')
    .description('Manage PaleoClaw research memory');

  // status command
  memoryCmd
    .command('status')
    .description('Show memory store status')
    .option('--json', 'Output as JSON')
    .action(async (options: MemoryCommandOptions) => {
      try {
        const store = new TaskMemoryStore();
        const status = store.getStatus();
        
        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
        } else {
          console.log('╔════════════════════════════════════════════════════════════╗');
          console.log('║              PaleoClaw Memory Store Status                 ║');
          console.log('╚════════════════════════════════════════════════════════════╝');
          console.log('');
          console.log(`📊 Memory Statistics:`);
          console.log(`   Short-term memories: ${status.shortCount}`);
          console.log(`   Long-term memories:  ${status.longCount}`);
          console.log('');
          console.log(`📁 Storage Locations:`);
          console.log(`   Root: ${status.memoryRoot}`);
          console.log(`   Short-term: ${status.shortDir}`);
          console.log(`   Long-term:  ${status.longFile}`);
        }
      } catch (error) {
        console.error('Error getting memory status:', error);
        process.exit(1);
      }
    });

  // short command
  memoryCmd
    .command('short')
    .description('List short-term memories')
    .option('-l, --limit <n>', 'Number of entries to show', '20')
    .option('-s, --status <status>', 'Filter by status (running, success, failed)')
    .option('--json', 'Output as JSON')
    .action(async (options: MemoryCommandOptions) => {
      try {
        const store = new TaskMemoryStore();
        const limit = parseInt(options.limit || '20', 10);
        const memories = store.listShort({ limit, status: options.status });
        
        if (options.json) {
          console.log(JSON.stringify(memories, null, 2));
        } else {
          console.log('╔════════════════════════════════════════════════════════════╗');
          console.log('║              Short-term Research Memories                  ║');
          console.log('╚════════════════════════════════════════════════════════════╝');
          console.log('');
          
          if (memories.length === 0) {
            console.log('No short-term memories found.');
            return;
          }
          
          for (const mem of memories) {
            const statusIcon = mem.status === 'success' ? '✓' : 
                              mem.status === 'failed' ? '✗' : '⏳';
            const promotedIcon = mem.promoted ? '★' : ' ';
            
            console.log(`${statusIcon}${promotedIcon} ${mem.taskId}`);
            console.log(`   Command: ${mem.command}`);
            console.log(`   Status:  ${mem.status}${mem.returnCode !== null ? ` (code: ${mem.returnCode})` : ''}`);
            console.log(`   Created: ${new Date(mem.createdAt).toLocaleString()}`);
            if (mem.finishedAt) {
              console.log(`   Finished: ${new Date(mem.finishedAt).toLocaleString()}`);
            }
            if (mem.error) {
              console.log(`   Error: ${mem.error.slice(0, 60)}${mem.error.length > 60 ? '...' : ''}`);
            }
            console.log('');
          }
        }
      } catch (error) {
        console.error('Error listing short-term memories:', error);
        process.exit(1);
      }
    });

  // long command
  memoryCmd
    .command('long')
    .description('List long-term memories')
    .option('-l, --limit <n>', 'Number of entries to show', '20')
    .option('--json', 'Output as JSON')
    .action(async (options: MemoryCommandOptions) => {
      try {
        const store = new TaskMemoryStore();
        const limit = parseInt(options.limit || '20', 10);
        const memories = store.listLong({ limit });
        
        if (options.json) {
          console.log(JSON.stringify(memories, null, 2));
        } else {
          console.log('╔════════════════════════════════════════════════════════════╗');
          console.log('║              Long-term Research Memories                   ║');
          console.log('╚════════════════════════════════════════════════════════════╝');
          console.log('');
          
          if (memories.length === 0) {
            console.log('No long-term memories found.');
            return;
          }
          
          for (const mem of memories) {
            console.log(`★ ${mem.taskId}`);
            console.log(`   Command: ${mem.command}`);
            console.log(`   Status:  ${mem.status}`);
            console.log(`   Summary: ${mem.summary.slice(0, 70)}${mem.summary.length > 70 ? '...' : ''}`);
            console.log(`   Reviewed: ${new Date(mem.reviewedAt).toLocaleString()}`);
            if (mem.lessons && mem.lessons.length > 0) {
              console.log(`   Lessons: ${mem.lessons.length} recorded`);
            }
            console.log('');
          }
        }
      } catch (error) {
        console.error('Error listing long-term memories:', error);
        process.exit(1);
      }
    });

  // archive command
  memoryCmd
    .command('archive')
    .description('Archive old short-term memories')
    .option('-d, --before-days <n>', 'Archive memories older than N days', '7')
    .option('-s, --status <status>', 'Filter by status')
    .option('--include-running', 'Include running tasks')
    .option('--json', 'Output as JSON')
    .action(async (options: MemoryCommandOptions) => {
      try {
        const store = new TaskMemoryStore();
        const beforeDays = parseInt(options.beforeDays || '7', 10);
        
        const result = store.archiveShort({
          beforeDays,
          status: options.status || '',
          includeRunning: options.includeRunning || false,
        });
        
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('╔════════════════════════════════════════════════════════════╗');
          console.log('║              Archive Operation Complete                    ║');
          console.log('╚════════════════════════════════════════════════════════════╝');
          console.log('');
          console.log(`📦 Archived: ${result.moved} memories`);
          console.log(`⏭️  Skipped:  ${result.skipped} memories`);
          console.log(`📅 Before:    ${result.beforeDays} days ago`);
          if (result.statusFilter) {
            console.log(`🔍 Status:    ${result.statusFilter}`);
          }
          console.log(`📁 Location:  ${result.archiveDir}`);
          
          if (result.archivedTaskIds.length > 0) {
            console.log('');
            console.log('Archived task IDs:');
            for (const id of result.archivedTaskIds.slice(0, 10)) {
              console.log(`  - ${id}`);
            }
            if (result.archivedTaskIds.length > 10) {
              console.log(`  ... and ${result.archivedTaskIds.length - 10} more`);
            }
          }
        }
      } catch (error) {
        console.error('Error archiving memories:', error);
        process.exit(1);
      }
    });

  // search command
  memoryCmd
    .command('search')
    .description('Search memories by content similarity')
    .argument('<query>', 'Search query')
    .option('-s, --scope <scope>', 'Search scope (short, long, archive, all)', 'long')
    .option('-k, --top-k <n>', 'Number of results', '5')
    .option('-m, --min-score <score>', 'Minimum similarity score', '0.15')
    .option('--json', 'Output as JSON')
    .action(async (query: string, options: MemoryCommandOptions) => {
      try {
        const store = new TaskMemoryStore();
        const topK = parseInt(options.topK || '5', 10);
        const minScore = parseFloat(options.minScore || '0.15');
        
        const results = store.searchMemory({
          query,
          scope: options.scope || 'long',
          topK,
          minScore,
        });
        
        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
        } else {
          console.log('╔════════════════════════════════════════════════════════════╗');
          console.log('║              Memory Search Results                         ║');
          console.log('╚════════════════════════════════════════════════════════════╝');
          console.log(`Query: "${query}"`);
          console.log(`Scope: ${options.scope || 'long'}`);
          console.log('');
          
          if (results.length === 0) {
            console.log('No matching memories found.');
            return;
          }
          
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            console.log(`${i + 1}. [${result.source}] Score: ${result.score}`);
            console.log(`   Task ID: ${result.taskId}`);
            
            const payload = result.payload as any;
            if (payload.command) {
              console.log(`   Command: ${payload.command}`);
            }
            if (payload.summary) {
              console.log(`   Summary: ${payload.summary.slice(0, 70)}${payload.summary.length > 70 ? '...' : ''}`);
            }
            console.log('');
          }
        }
      } catch (error) {
        console.error('Error searching memories:', error);
        process.exit(1);
      }
    });

  // review command
  memoryCmd
    .command('review')
    .description('Review a short-term memory and promote to long-term')
    .argument('<task-id>', 'Task ID to review')
    .option('-s, --summary <text>', 'Custom summary')
    .option('--json', 'Output as JSON')
    .action(async (taskId: string, options: MemoryCommandOptions) => {
      try {
        const store = new TaskMemoryStore();
        
        const longMem = store.reviewTaskToLong(
          taskId,
          options.summary || '',
          undefined,
          undefined
        );
        
        if (options.json) {
          console.log(JSON.stringify(longMem, null, 2));
        } else {
          console.log('╔════════════════════════════════════════════════════════════╗');
          console.log('║              Memory Review Complete                        ║');
          console.log('╚════════════════════════════════════════════════════════════╝');
          console.log('');
          console.log(`✓ Task ${taskId} promoted to long-term memory`);
          console.log(`  Summary: ${longMem.summary}`);
          console.log(`  Lessons: ${longMem.lessons.length} recorded`);
          console.log(`  Actions: ${longMem.nextActions.length} suggested`);
        }
      } catch (error) {
        console.error('Error reviewing memory:', error);
        process.exit(1);
      }
    });
}
