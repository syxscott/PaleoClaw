---
name: paper_summary
description: "Generate structured summaries of scientific papers from abstract or full text. Output includes: Background, Methods, Results, Significance. Use when: analyzing paper content, extracting key findings, comparing multiple papers, literature review."
homepage: https://paleobiodb.org/
metadata:
  {
    "paleoclaw":
      {
        "emoji": "📝",
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

# Paper Summary Skill

Generate structured summaries of paleontology research papers.

## When to Use

✅ **USE this skill when:**

- "Summarize this paper"
- "What are the main findings of [paper]?"
- "Extract key results from this abstract"
- "Compare findings from multiple papers"
- Literature review preparation
- Understanding complex methodologies

## Output Structure

Always use this format:

```
## Paper Summary

**Title**: [Full title]
**Authors**: [Author list]
**Journal**: [Journal name]
**Year**: [Publication year]
**DOI**: [DOI link]

---

### Background
[Research context, knowledge gap, research question]

### Methods
[Data sources, analytical methods, techniques used]

### Results
[Key findings, quantitative results, statistical outcomes]

### Significance
[Scientific contributions, implications, future directions]

---

### Key Terms
[3-5 relevant keywords]

### Limitations
[Study limitations noted by authors]

### Citations
[Link to paper: https://doi.org/...]
```

## Scientific Integrity Rules

⚠️ **CRITICAL**:

- NEVER fabricate paper content or findings
- If paper cannot be accessed: "Unable to access full text. Abstract only."
- Clearly distinguish abstract vs full-text summaries
- Do not overstate conclusions beyond what authors claim
- Note when findings are preliminary or disputed
- Always include DOI for verification
- Mark preprints as "not peer-reviewed"

## Notes

- Abstracts provide limited detail; request full text when possible
- Some papers require institutional access
- Preprints may change before publication
- Contact authors for clarifications when needed
