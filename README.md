# 🦕 PaleoClaw

<p align="center">
  <strong>An AI Research Agent for Paleontology</strong>
</p>

<p align="center">
  <em>"Ex Fossilo, Scientia" - From Fossils, Knowledge</em>
</p>

<p align="center">
  <a href="https://github.com/paleoclaw/paleoclaw"><img src="https://img.shields.io/badge/version-1.0.0-blue.svg?style=for-the-badge" alt="Version"></a>
  <a href="https://github.com/paleoclaw/paleoclaw/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/paleoclaw/paleoclaw/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**PaleoClaw** is a specialized AI research assistant for **paleontology and geosciences**, built on the multi-channel AI gateway framework.

It automates scientific research workflows including literature search, database queries, taxonomic lookup, stratigraphy analysis, and research synthesis.

---

## 🎯 Features

### Research Skills

| Skill | Description | Data Sources |
|-------|-------------|--------------|
| `paper_search` | Search paleontology papers | CrossRef, Semantic Scholar, arXiv |
| `pbdb_query` | Query fossil occurrences | Paleobiology Database |
| `taxonomy_lookup` | Taxonomic classification | PBDB, NCBI |
| `stratigraphy_lookup` | Geological formation data | PBDB, Macrostrat |
| `paper_summary` | Structured paper summaries | AI Analysis |
| `research_assistant` | Comprehensive research workflow | All above |

### Data Sources

- **Paleobiology Database (PBDB)** - Fossil occurrences and taxonomy
- **CrossRef** - Peer-reviewed literature metadata  
- **Semantic Scholar** - Citation analysis
- **arXiv** - Preprints (clearly marked)

### Scientific Integrity

✅ **No fabrication** - All data verified against primary sources  
✅ **Verifiable citations** - Every paper includes DOI  
✅ **Transparent uncertainty** - Clearly marks disputed data  
✅ **Reproducible** - Documents all queries and parameters

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 22.12.0
- **curl** (for API calls)

### Installation

```bash
# 1. Install PaleoClaw
npm install -g paleoclaw@latest
# or: pnpm add -g paleoclaw@latest

# 2. Run onboarding
paleoclaw onboard --install-daemon

# 3. Configure AI model
paleoclaw config set --ai-provider openai --ai-model gpt-5-mini
# Or use other providers:
# paleoclaw config set --ai-provider qwen --ai-model qwen-plus-latest
# paleoclaw config set --ai-provider gemini --ai-model gemini-flash-latest
```

### First Use

```bash
# Start the gateway
paleoclaw gateway --port 18789 --verbose

# Query literature
paleoclaw agent --message "Find papers about Jurassic theropods"

# Query taxonomy
paleoclaw agent --message "What is the classification of Tyrannosaurus rex?"

# Query fossil data
paleoclaw agent --message "Query PBDB for Triceratops occurrences"

# Comprehensive research
paleoclaw agent --message "Write a literature review on sauropod gigantism"
```

---

## 📋 Usage Examples

### Literature Search

```bash
paleoclaw agent --message "Find papers about dinosaur extinction at K-Pg boundary from 2020-2026"
```

**Expected Output:**
```
1. **The last dinosaurs: K-Pg boundary extinction patterns**
   Authors: Smith, J., Johnson, K., Williams, R.
   Year: 2023
   Journal: Paleobiology
   DOI: 10.1016/j.palaeo.2023.111234
   Citations: 42

2. **Iridium anomalies and dinosaur extinction**
   Authors: Chen, L., et al.
   Year: 2022
   Journal: Cretaceous Research
   DOI: 10.1016/j.cretres.2022.105234
   Citations: 28
```

### Taxonomy Lookup

```bash
paleoclaw agent --message "What is the full classification of Velociraptor mongoliensis?"
```

**Expected Output:**
```
**Taxonomic Classification**

**Name**: Velociraptor mongoliensis
**Rank**: species
**Status**: valid

**Full Hierarchy**:
└─ Kingdom: Animalia
   └─ Phylum: Chordata
      └─ Class: Dinosauria
         └─ Order: Saurischia
            └─ Suborder: Theropoda
               └─ Family: Dromaeosauridae
                  └─ Genus: Velociraptor
                     └─ Species: V. mongoliensis

Data source: Paleobiology Database (queried 2026-03-08)
```

### Fossil Occurrences

```bash
paleoclaw agent --message "Where have Tyrannosaurus fossils been found? Query PBDB."
```

**Expected Output:**
```
**Fossil Occurrences** for Tyrannosaurus (from PBDB):

1. **Location**: Montana, USA
   Coordinates: 45.0, -110.0
   Age: 66 Ma
   Formation: Hell Creek Formation

2. **Location**: South Dakota, USA
   Coordinates: 43.5, -102.5
   Age: 66 Ma
   Formation: Hell Creek Formation

3. **Location**: Wyoming, USA
   Coordinates: 44.0, -107.0
   Age: 66 Ma
   Formation: Lance Formation

Total occurrences: ~50
Data source: PBDB (paleobiodb.org)
```

### Stratigraphy Query

```bash
paleoclaw agent --message "What is the age and location of Yixian Formation?"
```

**Expected Output:**
```
**Stratigraphic Information**

**Formation**: Yixian Formation
**Age**: ~125 Ma
**Period**: Early Cretaceous
**Epoch**: Barremian-Aptian
**Location**: Liaoning, China
**Lithology**: Volcaniclastic sediments

**Associated Fossils**:
- Sinosauropteryx prima (feathered dinosaur)
- Confuciusornis sanctus (early bird)
- Psittacosaurus lujiatunensis (ceratopsian)

**Significance**: Lagerstätte with exceptional preservation
```

### Comprehensive Research

```bash
paleoclaw agent --message "Write a comprehensive research summary on theropod dinosaur diversity in the Early Cretaceous of China"
```

**Expected Output:**
```
# Research Report: Theropod Diversity in Early Cretaceous China

## Executive Summary
The Early Cretaceous of China preserves one of the world's most important 
theropod dinosaur faunas, particularly from Liaoning Province...

## 1. Taxonomic Background
[Full taxonomic hierarchy]

## 2. Geological Context
- Stratigraphic Range: Early Cretaceous (145-100 Ma)
- Major Formations: Yixian, Jiufotang, Huajiying
- Geographic Distribution: Liaoning, Hebei, Inner Mongolia

## 3. Literature Review
[5-10 paper summaries with full citations]

## 4. Fossil Record Analysis
[PBDB query results]

## 5. Current Scientific Understanding
[Established knowledge, debates, gaps]

## 6. References
[Formatted bibliography with DOIs]
```

---

## 🔧 Configuration

### Environment Variables

```bash
# AI Provider
export PALEOCLAW_AI_PROVIDER=openai
export PALEOCLAW_AI_MODEL=gpt-5-mini
export PALEOCLAW_AI_API_KEY=your-api-key

# Or use other providers
export PALEOCLAW_AI_PROVIDER=qwen
export PALEOCLAW_AI_MODEL=qwen-plus-latest
```

### Config File (~/.paleoclaw/paleoclaw.json)

```json
{
  "agent": {
    "model": "openai/gpt-5-mini"
  },
  "skills": {
    "load": {
      "extraDirs": ["~/.paleoclaw/skills"]
    }
  }
}
```

---

## 📁 Project Structure

```
PaleoClaw/
├── agents/
│   └── paleoclaw-research-agent/
│       └── AGENT.md          # Agent configuration
├── skills/
│   ├── paper_search/
│   ├── pbdb_query/
│   ├── taxonomy_lookup/
│   ├── stratigraphy_lookup/
│   ├── paper_summary/
│   └── research_assistant/
├── docs/
├── scripts/
├── soul.md                    # System identity
├── user.md                    # User preferences
├── PALEOCLAW_IDENTITY.md      # Core system prompt
├── package.json
├── README.md
└── LICENSE
```

---

## 🔬 Scientific Integrity

### Data Verification

All PaleoClaw outputs follow strict verification rules:

1. **Taxonomic names** verified via PBDB
2. **Paper citations** include valid DOI
3. **Age ranges** include uncertainty (in Ma)
4. **Disputed claims** clearly marked
5. **Data sources** explicitly cited

### Handling Unknown Data

When data is unavailable:

```
No verified fossil occurrences found in PBDB for [taxon name].

This may indicate:
- Limited fossil record
- Recent taxonomic revision
- Data not yet in database

Recommendation: Check primary literature for recent discoveries.
```

### Citation Format

All papers cited with full metadata:

```
Author(s). (Year). Title. Journal, Volume(Issue), Pages.
https://doi.org/10.xxxx/xxxxx
```

---

## 📚 Documentation

- [Usage Examples](docs/USAGE_EXAMPLES.md) - Detailed usage guide
- [Integration Guide](docs/INTEGRATION.md) - Channel integration
- [Development Guide](docs/DEVELOPMENT.md) - For contributors
- [System Identity](PALEOCLAW_IDENTITY.md) - Core system prompt

---

## 🤝 Contributing

Contributions welcome! Areas of interest:

- New data source integrations
- Additional research skills
- Improved citation formatting
- Non-English language support
- Documentation improvements

### How to Contribute

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `bash scripts/test.sh`
5. Submit a pull request

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Data from [Paleobiology Database](https://paleobiodb.org/)
- Literature metadata from [CrossRef](https://www.crossref.org/)
- Citation analysis from [Semantic Scholar](https://www.semanticscholar.org/)
- Preprints from [arXiv](https://arxiv.org/)

---

## 📖 Citation

If you use PaleoClaw in your research, please cite:

```
PaleoClaw Contributors. (2026). PaleoClaw: An AI Research Agent for 
Paleontology. https://github.com/paleoclaw/paleoclaw

Data from PBDB: https://paleobiodb.org/
```

---

## 🔗 Support

- **Issues**: https://github.com/paleoclaw/paleoclaw/issues
- **Discussions**: https://github.com/paleoclaw/paleoclaw/discussions
- **Documentation**: https://github.com/paleoclaw/paleoclaw/docs

---

<p align="center">
  <strong>PaleoClaw: An AI Assistant for Paleontological Research</strong>
  <br>
  <em>"Ex Fossilo, Scientia" - From Fossils, Knowledge</em>
</p>
