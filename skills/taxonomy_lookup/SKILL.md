---
name: taxonomy_lookup
description: "Lookup paleontological taxonomic classification (kingdom, phylum, class, order, family, genus, species). Uses PBDB as primary source, with NCBI/Wikidata for auxiliary data. Use when: verifying classification hierarchy, checking taxonomic validity, finding related taxa."
homepage: https://github.com/syxscott/PaleoClaw
metadata:
  {
    "paleoclaw":
      {
        "emoji": "🔬",
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
          ],
      },
  }
---

# Taxonomy Lookup Skill

Query taxonomic classification for paleontological taxa.

## When to Use

✅ **USE this skill when:**

- "What is the classification of [taxon]?"
- "What family does [genus] belong to?"
- "Is [name] a valid taxon?"
- "List species in [family]"
- Verifying taxonomic hierarchy
- Finding sister taxa

## When NOT to Use

❌ **DON'T use this skill when:**

- Modern organism taxonomy only → use NCBI Taxonomy
- Genetic/molecular classification → use GenBank
- Unpublished or informal names → note as "nomen nudum"
- Highly disputed classifications → report multiple views

## Data Sources

**Primary**: Paleobiology Database (PBDB)
**Auxiliary**: NCBI Taxonomy, Wikidata (for cross-reference only)

## Commands

### Full Classification Lookup

```bash
# Get complete taxonomic hierarchy from PBDB
curl -s "https://paleobiodb.org/data1.2/taxa/list.json?name=Tyrannosaurus&rank=genus&show=class" | jq '
  .records[0] | 
  {
    name: .name,
    rank: .rank,
    kingdom: (.kingdom // "Unknown"),
    phylum: (.phylum // "Unknown"),
    class: (.class // "Unknown"),
    order: (.order // "Unknown"),
    family: (.family // "Unknown"),
    genus: (.name // "Unknown")
  }
'
```

### Species Lookup

```bash
# List species in a genus
curl -s "https://paleobiodb.org/data1.2/taxa/list.json?name=Tyrannosaurus&rank=species" | jq '
  .records[] | {name: .name, status: .status}
'
```

### Higher Taxa Query

```bash
# Find all genera in a family
curl -s "https://paleobiodb.org/data1.2/taxa/list.json?name=Tyrannosauridae&rank=genus" | jq '
  .records[] | {genus: .name}
'
```

### Taxonomic Status Check

```bash
# Check if taxon is valid
curl -s "https://paleobiodb.org/data1.2/taxa/list.json?name=Brontosaurus&rank=genus&show=class" | jq '
  .records[0] | {name: .name, status: (.status // "valid")}
'
```

## Response Format

```
**Taxonomic Classification**

**Name**: [Taxon name]
**Rank**: [species/genus/family/order/class/phylum]
**Status**: [valid/synonym/invalid]

**Full Hierarchy**:
└─ Kingdom: [Kingdom]
   └─ Phylum: [Phylum]
      └─ Class: [Class]
         └─ Order: [Order]
            └─ Family: [Family]
               └─ Genus: [Genus]
                  └─ Species: [Species]

**Synonyms**: [List if applicable]
**Common Name**: [If available]
```

## Scientific Integrity Rules

⚠️ **CRITICAL**:

- NEVER fabricate taxonomic classifications
- If taxon not found: "No verified taxonomic data found for [name] in PBDB."
- Clearly mark disputed classifications
- Note synonymies (e.g., Brontosaurus vs Apatosaurus)
- Distinguish formal vs informal names
- Report taxonomic uncertainty when present
- Classification systems vary; note alternative views

## Notes

- PBDB updated regularly by paleontologists
- Classification reflects current scientific consensus
- Some groups have better coverage than others
- Cross-reference with primary literature for critical work
