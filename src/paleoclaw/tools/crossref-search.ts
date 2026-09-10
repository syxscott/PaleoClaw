/**
 * CrossRef literature search tool
 */

import { retryAsync } from '../../vendor/retry/index.js';
import { toolRegistry } from './registry.js';

interface CrossrefParams {
  query?: string;
  rows?: number;
}

// Retry policy: max 3 attempts total with exponential backoff and jitter.
// Retries transient failures only — network-level fetch errors (TypeError)
// and HTTP 429/5xx. Other 4xx responses are returned without retrying.
async function fetchCrossrefWithRetry(url: URL, init?: RequestInit): Promise<Response> {
  return retryAsync(
    async () => {
      const response = await fetch(url, init);
      if (!response.ok) {
        const error = new Error(
          `CrossRef request failed: ${response.status} ${response.statusText}`,
        ) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }
      return response;
    },
    {
      attempts: 3,
      minDelayMs: 300,
      maxDelayMs: 5_000,
      jitter: 0.2,
      shouldRetry: (error) => {
        if (error instanceof TypeError) {
          return true;
        }
        const status = (error as { status?: unknown }).status;
        return status === 429 || (typeof status === 'number' && status >= 500 && status <= 599);
      },
    },
  );
}

async function crossrefSearchHandler(params: Record<string, unknown>): Promise<unknown> {
  const typed = params as CrossrefParams;
  const query = String(typed.query || '').trim();
  if (!query) {
    throw new Error('query is required');
  }

  const parsedRows = Number(typed.rows);
  const rows = Math.max(1, Math.min(50, Number.isFinite(parsedRows) ? parsedRows : 10));
  const api = new URL('https://api.crossref.org/works');
  api.searchParams.set('query', query);
  api.searchParams.set('rows', String(rows));
  api.searchParams.set('select', 'DOI,title,author,published-print,published-online,container-title');

  const response = await fetchCrossrefWithRetry(api, {
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


