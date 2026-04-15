/**
 * PBDB query tool
 */

import { toolRegistry } from './registry.js';

interface PbdbQueryParams {
  genus?: string;
  species?: string;
  baseName?: string;
  limit?: number;
}

async function pbdbQueryHandler(params: Record<string, unknown>): Promise<unknown> {
  const typed = params as PbdbQueryParams;
  const query = new URLSearchParams();
  query.set('show', 'coords,phylo,time,strat');

  if (typed.baseName) {
    query.set('base_name', typed.baseName);
  } else {
    const nameParts = [typed.genus, typed.species].filter(Boolean).join(' ').trim();
    if (nameParts) {
      query.set('base_name', nameParts);
    }
  }

  const limit = Math.max(1, Math.min(200, Number(typed.limit || 20)));
  query.set('limit', String(limit));

  const url = `https://paleobiodb.org/data1.2/occs/list.json?${query.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PBDB request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { records?: unknown[] };
  return {
    endpoint: url,
    count: Array.isArray(data.records) ? data.records.length : 0,
    records: data.records || [],
  };
}

toolRegistry.register({
  name: 'pbdb_query',
  category: 'database',
  description: 'Query fossil occurrences from Paleobiology Database (PBDB)',
  schema: {
    type: 'object',
    properties: {
      genus: { type: 'string', description: 'Genus name' },
      species: { type: 'string', description: 'Species epithet' },
      baseName: { type: 'string', description: 'Taxon name override' },
      limit: { type: 'number', description: 'Maximum records (1-200)' },
    },
    required: [],
  },
  handler: pbdbQueryHandler,
  timeoutMs: 15_000,
});

export {};
