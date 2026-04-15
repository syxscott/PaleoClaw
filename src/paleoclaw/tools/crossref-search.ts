/**
 * CrossRef literature search tool
 */

import { toolRegistry } from './registry.js';

interface CrossrefParams {
  query?: string;
  rows?: number;
}

async function crossrefSearchHandler(params: Record<string, unknown>): Promise<unknown> {
  const typed = params as CrossrefParams;
  const query = String(typed.query || '').trim();
  if (!query) {
    throw new Error('query is required');
  }

  const rows = Math.max(1, Math.min(50, Number(typed.rows || 10)));
  const api = new URL('https://api.crossref.org/works');
  api.searchParams.set('query', query);
  api.searchParams.set('rows', String(rows));
  api.searchParams.set('select', 'DOI,title,author,published-print,published-online,container-title');

  const response = await fetch(api, {
    headers: {
      'User-Agent': 'PaleoClaw/1.6.0 (mailto:maintainer@example.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`CrossRef request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    message?: { items?: unknown[]; ['total-results']?: number };
  };

  return {
    query,
    totalResults: data.message?.['total-results'] || 0,
    items: data.message?.items || [],
  };
}

toolRegistry.register({
  name: 'crossref_search',
  category: 'research',
  description: 'Search scholarly metadata from CrossRef',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query text' },
      rows: { type: 'number', description: 'Max rows (1-50)' },
    },
    required: ['query'],
  },
  handler: crossrefSearchHandler,
  timeoutMs: 15_000,
});

export {};
