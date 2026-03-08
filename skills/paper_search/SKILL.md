---
name: paper_search
description: "Search paleontology and geoscience research papers via CrossRef, Semantic Scholar, and arXiv APIs. Use when: finding papers by topic/author/DOI, literature reviews, checking citations. Returns: title, authors, year, DOI, abstract. NOT for: accessing full-text PDFs (use browser tool), non-scientific articles."
homepage: https://www.crossref.org/
metadata:
  {
    "paleoclaw":
      {
        "emoji": "📄",
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

# Paper Search Skill

Search paleontology and geoscience research papers using academic APIs.

## When to Use

✅ **USE this skill when:**

- "Find papers about [topic]"
- "Search for dinosaur evolution papers"
- "What papers cite [author/year]?"
- "Get papers by DOI"
- Literature review research
- Finding recent publications in paleontology

## When NOT to Use

❌ **DON'T use this skill when:**

- Accessing full-text PDFs → use browser tool or institutional access
- Non-scientific articles → use general web search
- Books or book chapters → use library catalogs
- Preprints not on arXiv → check bioRxiv/EarthArXiv directly

## Data Sources

- **CrossRef API**: Primary source for DOIs and metadata
- **Semantic Scholar API**: Citations and impact metrics
- **arXiv API**: Preprints (q-bio, physics, related fields)

## Commands

### Search by Topic

```bash
# Search CrossRef (paleontology topics)
curl -s "https://api.crossref.org/works?query=paleontology+theropod&filter=type:journal-article&rows=10" | jq '.message.items[] | {title: .title[0], author: .author[].given + " " + .author[].family, year: .created["date-parts"][0][0], doi: .DOI}'

# Search with journal filter
curl -s "https://api.crossref.org/works?query=Jurassic+dinosaur&filter=journal-title:Paleobiology&rows=5" | jq '.message.items[] | {title: .title[0], doi: .DOI, year: .created["date-parts"][0][0]}'
```

### Search by Author

```bash
# Papers by specific author
curl -s "https://api.crossref.org/works?query.author=Stephen+Jay+Gould&rows=10" | jq '.message.items[] | {title: .title[0], year: .created["date-parts"][0][0], doi: .DOI}'
```

### Get Paper by DOI

```bash
# Lookup specific DOI
curl -s "https://api.crossref.org/works/10.1016/j.palaeo.2023.111234" | jq '.message | {title: .title[0], author: [.author[].given + " " + .author[].family], journal: .container-title[0], year: .created["date-parts"][0][0]}'
```

### Semantic Scholar (Citations)

```bash
# Get citation count
curl -s "https://api.semanticscholar.org/graph/v1/paper/DOI:10.1016/j.palaeo.2023.111234?fields=title,year,citationCount" | jq '.'
```

## Response Format

Always return papers in this format:

```
1. **Title**
   Authors: Author1, Author2, ...
   Year: YYYY
   Journal: Journal Name
   DOI: 10.xxxx/xxxxx
   Abstract: [Brief summary if available]
   Citations: N (if available)
```

## Example Queries

### Find Theropod Papers

```bash
curl -s "https://api.crossref.org/works?query=theropod+dinosaur+Cretaceous&filter=type:journal-article,from-pub-date:2020-01-01&rows=5" | jq -r '.message.items[] | "**\(.title[0])**\nAuthors: \([.author[].given + " " + .author[].family] | join(", "))\nYear: \(.created["date-parts"][0][0])\nDOI: \(.DOI)\n"'
```

### Search by Formation

```bash
curl -s "https://api.crossref.org/works?query=Yixian+Formation+fossil&rows=5" | jq '.message.items[] | {title: .title[0], doi: .DOI, year: .created["date-parts"][0][0]}'
```

## Scientific Integrity Rules

⚠️ **CRITICAL**:

- NEVER fabricate paper titles, authors, or DOIs
- If API returns no results, respond: "No verified scientific papers found for [query]."
- Always verify DOI format before returning
- Do not claim access to papers behind paywalls
- Clearly distinguish peer-reviewed vs preprint

## Notes

- CrossRef has rate limits (~50 requests/minute)
- Some journals require subscription for full text
- Use DOI links: https://doi.org/[DOI]
- For comprehensive reviews, combine multiple searches
