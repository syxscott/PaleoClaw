# GBDB (GBIF) Integration Feasibility for PaleoClaw

Status: **feasible, with a scoped role** — verified by live API probes on 2026-10-31.
Scope: one new research tool that complements the existing `pbdb_query` tool.

## 1. What "GBDB" resolves to

The acronym is ambiguous, so the candidates were probed directly:

| Candidate | Probe | Result |
|---|---|---|
| `gbdb.io`, `gbdb.org` | DNS + HTTPS | **Do not resolve** (curl exit 000) — no such service |
| **GBIF** — Global Biodiversity Information Facility | `api.gbif.org/v1/...` | **Live and fully usable, no API key required** |
| Gobi Database (palaeobotany.org / gobi.org) | `/api/v1/taxa`, `/api/v1/occurrences` | Host resolves, but every REST path returns **404**; no public API surface documented on the landing page |

Conclusion: **GBIF is the actionable interpretation.** It is the only candidate with a
documented, keyless public REST API, and it is the closest living analogue to the
"Paleobiology Database" role the project already fills.

Everything below therefore evaluates GBIF. If the intent was a different "GBDB",
the Gobi path needs a direct contact/wrapper decision first — there is no public API
to code against today.

## 2. Verified API facts (live probes)

| Property | Measurement |
|---|---|
| Authentication | **None** — `species/match` and `occurrence/search` work with no key |
| Latency | 0.65 s (`species/match`), 0.73 s (`occurrence/search`) from this host |
| Endpoints used | `GET /v1/species/match?name=`, `GET /v1/occurrence/search?scientificName=&basisOfRecord=&limit=&facet=` |
| Fossil enum | `basisOfRecord=FOSSIL_SPECIMEN` (**not** `PRESERVED_SPECIMEN` — that returns 0 for fossils) |
| Volume | Trilobita: **259,547** fossil records; *Tyrannosaurus rex*: 239 `FOSSIL_SPECIMEN` + 2,675 `MATERIAL_CITATION` |
| Licensing | **Per dataset**, not global. Observed `CC0-1.0` (Yale Peabody) and `CC-BY-NC-4.0` on others — the tool must surface `license` per record |

## 3. Complementarity with the existing tools

Measured field-by-field against the current `pbdb_query` (`show=coords,phylo,time,strat`):

| Capability | GBIF | PBDB (current) | CrossRef (current) |
|---|---|---|---|
| Fossil occurrence search | ✅ 259K-scale | ✅ | — |
| Taxon name matching (synonyms, confidence) | ✅ `matchType`/`confidence` | ⚠️ basic | — |
| **Specimen/catalogue identity** (`catalogNumber`, `collectionCode`, `institutionCode`) | ✅ | ❌ | ❌ |
| **Persistent specimen identifiers** (e.g. `http://id.luomus.fi/HS.P3163`) | ✅ | ❌ | ❌ |
| **Collector / identifier** (`identifiedBy`, `recordedBy`) | ✅ | ❌ | ❌ |
| Fine-grained locality + collection date | ✅ `stateProvince`/`locality`/`eventDate` | ⚠️ coords only | ❌ |
| **Stratigraphy** (`formation`, `member`) | ❌ | ✅ `show=strat` | ❌ |
| **Age range** (`eag`/`lag`, epochs) | ❌ | ✅ `show=time` | ❌ |
| **Literature citation per record** (`rid` → `ref:*`) | ❌ **absent on fossils** | ✅ | ✅ |
| Dataset / publisher provenance | ✅ `datasetKey`/`publishingOrgKey` | ⚠️ partial | — |

**The gap GBIF uniquely fills:** the *physical specimen* behind a fossil occurrence —
catalogue number, holding institution, collector, and the persistent identifiers that
let a researcher request or cite the actual object. PBDB returns occurrences and
taxonomy; it does not return specimen records.

**The gap GBIF cannot fill, and must not be asked to:** literature provenance and
stratigraphy. GBIF fossil records carry **no `literature` field** (verified: the
`literature` facet returns empty on 259K Trilobita fossils). Any design that routes
citation verification through GBIF would break the project's "verifiable citations"
promise — that path must stay on PBDB's `rid` + `crossref_search`.

## 4. Integration cost

The existing tool contract is small and the reference implementation is 95 lines
(`src/paleoclaw/tools/pbdb-query.ts`): `toolRegistry.register({ name, category,
description, schema, handler, timeoutMs })` with a JSON Schema, plus the vendored
`retryAsync` already used by that tool.

| Component | Effort |
|---|---|
| `src/paleoclaw/tools/gbif-specimen-query.ts` | ~110 lines (fetch + retry + schema + handler) |
| Registry / loader / barrel exports | ~6 lines (mirror the PBDB entry) |
| Tests (mock `fetch`, as the PBDB tool's tests do) | ~5 cases: match hit, fossil enum, zero-result, 429→retry, licence passthrough |
| Skill wrapper (`skills/gbif_specimen_lookup/`) if desired | optional, follows `skills/pbdb_query/` |

No new dependency: `fetch` + `node:` built-ins + the vendored retry package.

## 5. Proposed shape

```
name: gbif_specimen_query
category: database
description: Query specimen records (catalogue, institution, collector, locality)
             from GBIF — complements fossil occurrences from PBDB
params: taxonName | scientificName, country?, limit?, includeCitations?
returns: { endpoint, count, records: [{
            scientificName, catalogNumber, institutionCode, collectionCode,
            identifiers, country, stateProvince, locality, eventDate,
            identifiedBy, recordedBy, datasetName, datasetKey, license }] }
```

Design notes:
- Always request `basisOfRecord=FOSSIL_SPECIMEN` for paleo use; `MATERIAL_CITATION`
  entries are references, not specimens (2,675 vs 239 on *T. rex*).
- Return `license` per record — it varies by dataset, and non-commercial
  (`CC-BY-NC`) datasets exist.
- Surface `datasetName`/`datasetKey` so a citation can name the publishing dataset.
- Keep `limit` clamped like `pbdb_query` (1–200) and reuse `retryAsync` with the
  same 429/5xx/network-only policy.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Licence heterogeneity (CC0 / CC-BY / CC-BY-NC mixed) | Return `license` per record; document that redistribution obligations follow the dataset |
| Record semantics differ from PBDB occurrences | Name and document the tool as *specimen* lookup; keep occurrence search on PBDB |
| Volume skew — `MATERIAL_CITATION` dwarfs fossils | Hard-code the fossil `basisOfRecord` filter |
| No literature on fossil records | Keep citation verification on PBDB/CrossRef; document the boundary explicitly |
| GBIF has no SLA | Same posture as the existing PBDB tool: retry with backoff, surface the endpoint URL in the result for verification |
| GBDB could later mean a different service | Keep the tool behind the existing registry so it can be swapped without touching callers |

## 7. Recommendation

Implement it — but as a **specimen-provenance companion** to `pbdb_query`, not as
another occurrence database. The three concrete wins it unlocks:

1. Catalogue numbers and holding institutions turn an occurrence into a citable,
   requestable object.
2. `identifiedBy` / `recordedBy` expose the human effort behind the record — useful
   for provenance-oriented research questions.
3. Persistent identifiers (institution/heritage URIs) survive dataset reshuffles in
   a way occurrence IDs do not.

Everything else — occurrence counts, stratigraphy, age ranges, citation linking —
stays with PBDB/CrossRef, where the project already has stronger, tested paths.
