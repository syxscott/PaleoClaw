/**
 * PaleoClaw Session CLI
 */

import { SessionStore } from '../session/store.js';

interface SessionCommandOptions {
  limit?: string;
  json?: boolean;
  title?: string;
  tags?: string;
}

function parseLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseTags(raw?: string): string[] {
  if (!raw || !raw.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function registerSessionCommands(program: any): void {
  const sessionCmd = program
    .command('paleo-session')
    .alias('psession')
    .description('Manage PaleoClaw session history');

  sessionCmd
    .command('new')
    .description('Create a new session')
    .option('--title <title>', 'Session title')
    .option('--tags <csv>', 'Comma-separated tags')
    .option('--json', 'Output as JSON')
    .action(async (options: SessionCommandOptions) => {
      try {
        const store = new SessionStore();
        const created = store.createSession(options.title, parseTags(options.tags));

        if (options.json) {
          console.log(JSON.stringify(created, null, 2));
          return;
        }

        console.log('✓ Session created');
        console.log(`  ID: ${created.id}`);
        console.log(`  Title: ${created.title}`);
      } catch (error) {
        console.error('Error creating session:', error);
        process.exit(1);
      }
    });

  sessionCmd
    .command('list')
    .description('List recent sessions')
    .option('-l, --limit <n>', 'Max sessions to list', '20')
    .option('--json', 'Output as JSON')
    .action(async (options: SessionCommandOptions) => {
      try {
        const store = new SessionStore();
        const sessions = store.listSessions(parseLimit(options.limit, 20));

        if (options.json) {
          console.log(JSON.stringify(sessions, null, 2));
          return;
        }

        if (sessions.length === 0) {
          console.log('No sessions found.');
          return;
        }

        for (const session of sessions) {
          console.log(`• ${session.id}`);
          console.log(`  ${session.title}`);
          console.log(`  Messages: ${session.messages.length}`);
          console.log(`  Updated: ${new Date(session.updatedAt).toLocaleString()}`);
        }
      } catch (error) {
        console.error('Error listing sessions:', error);
        process.exit(1);
      }
    });

  sessionCmd
    .command('show')
    .description('Show one session')
    .argument('<session-id>', 'Session ID')
    .option('--json', 'Output as JSON')
    .action(async (sessionId: string, options: SessionCommandOptions) => {
      try {
        const store = new SessionStore();
        const session = store.getSession(sessionId);

        if (options.json) {
          console.log(JSON.stringify(session, null, 2));
          return;
        }

        console.log(`${session.title} (${session.id})`);
        console.log(`Created: ${new Date(session.createdAt).toLocaleString()}`);
        console.log(`Updated: ${new Date(session.updatedAt).toLocaleString()}`);
        console.log('');
        for (const message of session.messages) {
          console.log(`[${message.role}] ${new Date(message.createdAt).toLocaleString()}`);
          console.log(message.content);
          console.log('');
        }
      } catch (error) {
        console.error('Error showing session:', error);
        process.exit(1);
      }
    });

  sessionCmd
    .command('search')
    .description('Search historical messages')
    .argument('<query>', 'Search keyword')
    .option('-l, --limit <n>', 'Max result count', '10')
    .option('--json', 'Output as JSON')
    .action(async (query: string, options: SessionCommandOptions) => {
      try {
        const store = new SessionStore();
        const hits = store.search(query, parseLimit(options.limit, 10));

        if (options.json) {
          console.log(JSON.stringify(hits, null, 2));
          return;
        }

        if (hits.length === 0) {
          console.log('No matching history found.');
          return;
        }

        for (const hit of hits) {
          console.log(`• [${hit.score}] ${hit.title} (${hit.sessionId})`);
          console.log(`  ${hit.preview}`);
        }
      } catch (error) {
        console.error('Error searching sessions:', error);
        process.exit(1);
      }
    });

  sessionCmd
    .command('resume')
    .description('Mark a session as active (touch updatedAt)')
    .argument('<session-id>', 'Session ID')
    .option('--json', 'Output as JSON')
    .action(async (sessionId: string, options: SessionCommandOptions) => {
      try {
        const store = new SessionStore();
        const session = store.resumeSession(sessionId);

        if (options.json) {
          console.log(JSON.stringify(session, null, 2));
          return;
        }

        console.log(`✓ Resumed session ${session.id}`);
        console.log(`  Updated: ${new Date(session.updatedAt).toLocaleString()}`);
      } catch (error) {
        console.error('Error resuming session:', error);
        process.exit(1);
      }
    });
}
