/**
 * PBDB query tool
 */

import { retryAsync } from "../../vendor/retry/index.js";
import { toolRegistry } from "./registry.js";

interface PbdbQueryParams {
  genus?: string;
  species?: string;
  baseName?: string;
  limit?: number;
}

// Retry policy: max 3 attempts total with exponential backoff and jitter.
// Retries transient failures only — network-level fetch errors (TypeError)
// and HTTP 429/5xx. Other 4xx responses are returned without retrying.
async function fetchPbdbWithRetry(url: string): Promise<Response> {
  return retryAsync(
    async () => {
      const response = await fetch(url);
      if (!response.ok) {
        const error = new Error(
          `PBDB request failed: ${response.status} ${response.statusText}`,
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
        return status === 429 || (typeof status === "number" && status >= 500 && status <= 599);
      },
    },
  );
}

async function pbdbQueryHandler(params: Record<string, unknown>): Promise<unknown> {
  const typed = params as PbdbQueryParams;
  const query = new URLSearchParams();
  query.set("show", "coords,phylo,time,strat");

  if (typed.baseName) {
    query.set("base_name", typed.baseName);
  } else {
    const nameParts = [typed.genus, typed.species].filter(Boolean).join(" ").trim();
    if (nameParts) {
      query.set("base_name", nameParts);
    }
  }

  const parsedLimit = Number(typed.limit);
  const limit = Math.max(1, Math.min(200, Number.isFinite(parsedLimit) ? parsedLimit : 20));
  query.set("limit", String(limit));

  const url = `https://paleobiodb.org/data1.2/occs/list.json?${query.toString()}`;
  const response = await fetchPbdbWithRetry(url);
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
  name: "pbdb_query",
  category: "database",
  description: "Query fossil occurrences from Paleobiology Database (PBDB)",
  schema: {
    type: "object",
    properties: {
      genus: { type: "string", description: "Genus name" },
      species: { type: "string", description: "Species epithet" },
      baseName: { type: "string", description: "Taxon name override" },
      limit: { type: "number", description: "Maximum records (1-200)" },
    },
    required: [],
  },
  handler: pbdbQueryHandler,
  timeoutMs: 15_000,
});
