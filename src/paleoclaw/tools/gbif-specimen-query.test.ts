import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the GBIF specimen query tool.
 *
 * The tool self-registers with the shared registry on import, so these tests
 * import it for the side effect and exercise the handler through the
 * registry. Network access is mocked at the global fetch boundary.
 */

type FetchMock = ReturnType<typeof vi.fn>;

let fetchMock: FetchMock;

describe("gbif_specimen_query", () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    await import("./gbif-specimen-query.js");
    const { toolRegistry } = await import("./registry.js");
    if (!toolRegistry.has("gbif_specimen_query")) {
      throw new Error("gbif_specimen_query was not registered on import");
    }
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function okResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  it("is registered as a database tool with a specimen-focused description", async () => {
    const { toolRegistry } = await import("./registry.js");
    const tool = toolRegistry.get("gbif_specimen_query");
    expect(tool).toBeDefined();
    expect(tool?.category).toBe("database");
    expect(tool?.description).toContain("GBIF");
    expect(tool?.description).toContain("specimen");
  });

  it("queries the fossil basis-of-record and projects specimen fields", async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse({
        count: 1,
        results: [
          {
            key: 42,
            scientificName: "Trilobita",
            catalogNumber: "KUMIP 586909",
            institutionCode: "KU",
            collectionCode: "KUMIP",
            identifiers: ["http://id.luomus.fi/HS.P3163"],
            country: "United States of America",
            stateProvince: "Oklahoma",
            locality: "Private quarry",
            eventDate: "2025-07",
            identifiedBy: "Someone",
            recordedBy: "Else",
            datasetName: "Vertebrate Paleontology Division",
            datasetKey: "9643f840-f762-11e1-a439-00145eb45e9a",
            license: "http://creativecommons.org/publicdomain/zero/1.0/legalcode",
          },
        ],
      }),
    );

    const { toolRegistry } = await import("./registry.js");
    const result = await toolRegistry.execute("gbif_specimen_query", { taxonName: "Trilobita" });

    expect(result.ok).toBe(true);
    const data = result.data as {
      endpoint: string;
      totalInGbif: number;
      count: number;
      records: Array<Record<string, unknown>>;
    };
    expect(data.endpoint).toContain("api.gbif.org/v1/occurrence/search");
    expect(data.endpoint).toContain("scientificName=Trilobita");
    expect(data.endpoint).toContain("basisOfRecord=FOSSIL_SPECIMEN");
    expect(data.totalInGbif).toBe(1);
    expect(data.count).toBe(1);
    const record = data.records[0];
    expect(record.catalogNumber).toBe("KUMIP 586909");
    expect(record.institutionCode).toBe("KU");
    expect(record.license).toContain("creativecommons.org");
    // empty values must be dropped rather than passed as null placeholders
    expect(Object.values(record)).not.toContain(null);
    expect(Object.values(record)).not.toContain("");
  });

  it("uppercases the country filter and clamps the limit", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ count: 0, results: [] }));

    const { toolRegistry } = await import("./registry.js");
    await toolRegistry.execute("gbif_specimen_query", {
      taxonName: "Ammonoidea",
      country: "cn",
      limit: 9999,
    });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("country=CN");
    expect(url).toContain("limit=200");
    expect(url).toContain("basisOfRecord=FOSSIL_SPECIMEN");
  });

  it("rejects a query without any taxon name", async () => {
    const { toolRegistry } = await import("./registry.js");
    const result = await toolRegistry.execute("gbif_specimen_query", {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("taxonName");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries 5xx responses and succeeds on a later attempt", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("boom", { status: 502 }))
      .mockResolvedValueOnce(okResponse({ count: 0, results: [] }));

    const { toolRegistry } = await import("./registry.js");
    const result = await toolRegistry.execute("gbif_specimen_query", {
      taxonName: "Trilobita",
      limit: 1,
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 404 and reports the status", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 404 }));

    const { toolRegistry } = await import("./registry.js");
    const result = await toolRegistry.execute("gbif_specimen_query", { taxonName: "Trilobita" });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("404");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
