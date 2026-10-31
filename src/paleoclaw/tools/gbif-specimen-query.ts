/**
 * GBIF specimen query tool
 *
 * Complements `pbdb_query`: PBDB returns fossil *occurrences* (taxonomy,
 * stratigraphy, age ranges, literature), while GBIF returns the *specimen*
 * behind an occurrence — catalogue number, holding institution/collection,
 * collector and identifier, and the persistent identifiers that make the
 * physical object citable and requestable.
 *
 * API facts verified live (2026-10-31, see docs/design/gbif-integration-feasibility.md):
 * - no API key required
 * - the fossil basis-of-record enum value is FOSSIL_SPECIMEN (PRESERVED_SPECIMEN
 *   yields zero fossil hits)
 * - licences vary per dataset (CC0 / CC-BY / CC-BY-NC), so the licence is
 *   surfaced on every record
 */

import { retryAsync } from "../../vendor/retry/index.js";
import { toolRegistry } from "./registry.js";

interface GbifSpecimenQueryParams {
  taxonName?: string;
  scientificName?: string;
  country?: string;
  limit?: number;
}

// Retry policy: identical to the PBDB tool — max 3 attempts total with
// exponential backoff and jitter; retries transient failures only (network
// fetch errors and HTTP 429/5xx).
async function fetchGbifWithRetry(url: string): Promise<Response> {
  return retryAsync(
    async () => {
      const response = await fetch(url);
      if (!response.ok) {
        const error = new Error(
          `GBIF request failed: ${response.status} ${response.statusText}`,
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

interface GbifOccurrenceRecord {
  key?: number;
  scientificName?: string;
  catalogNumber?: string;
  institutionCode?: string;
  collectionCode?: string;
  identifiers?: string[];
  country?: string;
  stateProvince?: string;
  locality?: string;
  eventDate?: string;
  identifiedBy?: string;
  recordedBy?: string;
  datasetName?: string;
  datasetKey?: string;
  license?: string;
}

/**
 * Project a raw GBIF occurrence onto the stable fields this tool promises,
 * dropping empty values so callers never see `undefined` placeholders.
 */
function toSpecimenRecord(raw: GbifOccurrenceRecord): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  const set = (key: string, value: unknown): void => {
    if (value !== undefined && value !== null && value !== "") {
      record[key] = value;
    }
  };
  set("gbifKey", raw.key);
  set("scientificName", raw.scientificName);
  set("catalogNumber", raw.catalogNumber);
  set("institutionCode", raw.institutionCode);
  set("collectionCode", raw.collectionCode);
  set("identifiers", raw.identifiers);
  set("country", raw.country);
  set("stateProvince", raw.stateProvince);
  set("locality", raw.locality);
  set("eventDate", raw.eventDate);
  set("identifiedBy", raw.identifiedBy);
  set("recordedBy", raw.recordedBy);
  set("datasetName", raw.datasetName);
  set("datasetKey", raw.datasetKey);
  set("license", raw.license);
  return record;
}

async function gbifSpecimenQueryHandler(params: Record<string, unknown>): Promise<unknown> {
  const typed = params as GbifSpecimenQueryParams;
  const query = new URLSearchParams();

  // GBIF matches on the scientific name; accept both spellings for parity
  // with pbdb_query's genus/baseName duality.
  const name = (typed.scientificName ?? typed.taxonName ?? "").trim();
  if (!name) {
    throw new Error("gbif_specimen_query requires taxonName or scientificName");
  }
  query.set("scientificName", name);

  // Fossil specimens only: MATERIAL_CITATION entries are literature references
  // (2,675 vs 239 for T. rex) and HUMAN_OBSERVATION entries are not fossils.
  query.set("basisOfRecord", "FOSSIL_SPECIMEN");

  const country = (typed.country ?? "").trim();
  if (country) {
    // GBIF expects ISO 2-letter codes; pass through uppercase for usability.
    query.set("country", country.toUpperCase());
  }

  const parsedLimit = Number(typed.limit);
  const limit = Math.max(1, Math.min(200, Number.isFinite(parsedLimit) ? parsedLimit : 20));
  query.set("limit", String(limit));

  const url = `https://api.gbif.org/v1/occurrence/search?${query.toString()}`;
  const response = await fetchGbifWithRetry(url);
  if (!response.ok) {
    throw new Error(`GBIF request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { count?: number; results?: GbifOccurrenceRecord[] };
  const results = Array.isArray(data.results) ? data.results : [];
  return {
    endpoint: url,
    totalInGbif: typeof data.count === "number" ? data.count : undefined,
    count: results.length,
    records: results.map(toSpecimenRecord),
  };
}

toolRegistry.register({
  name: "gbif_specimen_query",
  category: "database",
  description:
    "Query fossil specimen records (catalogue number, institution, collector, locality, " +
    "persistent identifiers) from GBIF — complements fossil occurrences from PBDB",
  schema: {
    type: "object",
    properties: {
      taxonName: {
        type: "string",
        description: "Taxon name, e.g. 'Trilobita' or 'Tyrannosaurus rex'",
      },
      scientificName: {
        type: "string",
        description: "Scientific name override (alias of taxonName)",
      },
      country: { type: "string", description: "ISO 2-letter country filter, e.g. 'US', 'CN'" },
      limit: { type: "number", description: "Maximum records (1-200)" },
    },
    required: ["taxonName"],
  },
  handler: gbifSpecimenQueryHandler,
  timeoutMs: 15_000,
});
