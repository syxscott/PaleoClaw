---
name: gbif_specimen_lookup
description: "Query GBIF for fossil specimen records — catalogue numbers, holding institutions, collectors, localities, and persistent identifiers. Use when: finding the museum specimen behind a fossil occurrence, citing a physical specimen, requesting collection material, checking which institution holds fossils of a taxon. NOT for: occurrence counts and stratigraphy (use pbdb_query), literature search (use paper_search), modern living-species data."
homepage: https://github.com/syxscott/PaleoClaw
metadata:
  {
    "paleoclaw":
      {
        "emoji": "🏛️",
        "requires": { "bins": ["curl"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "curl",
              "bins": ["curl"],
              "label": "Install curl (brew)",
            },
            {
              "id": "apt",
              "kind": "apt",
              "package": "curl",
              "bins": ["curl"],
              "label": "Install curl (apt)",
            },
          ],
      },
  }
---

# GBIF Specimen Lookup Skill

Query the Global Biodiversity Information Facility (GBIF) for fossil **specimen**
records — the physical objects behind fossil occurrences.

## When to Use

✅ **USE this skill when:**

- "Which museum holds specimens of [taxon]?"
- "Find the catalogue number for a [taxon] fossil"
- "Cite a physical specimen of [species]"
- "Where can I request [taxon] material?"
- "Who identified/collected the [taxon] specimens from [country]?"

## When NOT to Use

❌ **DON'T use this skill when:**

- Occurrence counts, stratigraphy, age ranges → use `pbdb_query`
- Literature search and citation verification → use `paper_search` / `crossref_search`
- Modern living-species observations → this tool hard-filters to fossil specimens
- Unpublished or private collections

## Tool (preferred)

The built-in tool `gbif_specimen_query` wraps this API with retry and field
projection:

```
gbif_specimen_query --params '{"taxonName":"Trilobita","country":"US","limit":10}'
```

## API (direct curl)

Base URL: `https://api.gbif.org/v1/` — no API key required.

### Fossil specimens for a taxon

```bash
curl -s "https://api.gbif.org/v1/occurrence/search?scientificName=Trilobita&basisOfRecord=FOSSIL_SPECIMEN&limit=10" \
  | jq '.results[] | {name: .scientificName, catalog: .catalogNumber, institution: .institutionCode, collection: .collectionCode, country: .country, license: .license}'
```

### Persistent specimen identifiers

```bash
curl -s "https://api.gbif.org/v1/occurrence/search?scientificName=Tyrannosaurus+rex&basisOfRecord=FOSSIL_SPECIMEN&limit=5" \
  | jq '.results[] | {name: .scientificName, id: .identifiers, catalog: .catalogNumber}'
```

### Filter by country (ISO 2-letter)

```bash
curl -s "https://api.gbif.org/v1/occurrence/search?scientificName=Ammonoidea&basisOfRecord=FOSSIL_SPECIMEN&country=CN&limit=20" | jq '.count'
```

## Important Notes

- **Always** pass `basisOfRecord=FOSSIL_SPECIMEN` — the enum value for fossils.
  `PRESERVED_SPECIMEN` yields zero fossil hits; `MATERIAL_CITATION` entries are
  literature references, not specimens.
- **Licences vary per dataset** (CC0, CC-BY, CC-BY-NC observed). The `license`
  field is returned on every record — respect it when redistributing.
- GBIF fossil records carry **no literature field**. For citation verification
  use PBDB's `rid` reference links + CrossRef.
