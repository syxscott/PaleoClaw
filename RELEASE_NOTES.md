# 🦕 PaleoClaw Release Notes

This document contains the release notes for PaleoClaw, a specialized AI research agent for paleontology and geosciences.

---

## v1.1.0 (2026-03-09) - Activity Monitoring! 🆕

### 🎉 Overview

This release adds comprehensive computer activity monitoring capabilities to PaleoClaw, transforming it from a paleontology research assistant into a complete productivity tracking system.

### ✨ New Features

#### 1. Screen Monitor 🖥️

Real-time screen activity monitoring and screenshot capture:

- **Screenshot Capture**: Take periodic screenshots at configurable intervals
- **Cross-Platform Support**: Works on macOS, Linux, and Windows
- **Privacy Protection**: Local storage by default, no uploads without permission
- **Activity Summary**: Generate visual activity logs with timestamps

**Usage:**
```bash
paleoclaw agent --message "Start monitoring my screen activity"
paleoclaw agent --message "What have I been working on for the past 2 hours?"
```

#### 2. Activity Logger 📝

Comprehensive activity tracking for all computer operations:

- **Application Tracking**: Log which applications you use and for how long
- **File Access Tracking**: Monitor file access and modifications
- **Website History**: Track websites visited (with privacy controls)
- **Command History**: Record terminal/command line commands
- **Structured Logging**: JSON and Markdown export formats

**Usage:**
```bash
paleoclaw agent --message "Start logging my computer activity"
paleoclaw agent --message "What have I been doing this session?"
```

#### 3. Daily Log Generator 📊

Generate comprehensive daily activity reports in Markdown format:

- **Daily Reports**: Automatic generation of daily activity summaries
- **Productivity Analysis**: Metrics and productivity scores
- **File Tracking**: List of files created/modified each day
- **Weekly Reports**: Aggregate weekly activity summaries
- **Search by Time**: Find files or activities from specific times

**Usage:**
```bash
paleoclaw agent --message "Generate my daily log for today"
paleoclaw agent --message "Where did I save the file I was working on at 3 PM?"
paleoclaw agent --message "Generate my weekly activity report"
```

### 📦 Existing Features (v1.0.0)

All features from v1.0.0 are preserved and enhanced:

#### Research Skills

| Skill | Description | Data Sources |
|-------|-------------|--------------|
| `paper_search` | Search paleontology papers | CrossRef, Semantic Scholar, arXiv |
| `pbdb_query` | Query fossil occurrences | Paleobiology Database |
| `taxonomy_lookup` | Taxonomic classification | PBDB, NCBI |
| `stratigraphy_lookup` | Geological formation data | PBDB, Macrostrat |
| `paper_summary` | Structured paper summaries | AI Analysis |
| `research_assistant` | Comprehensive research workflow | All above |

### 🔒 Privacy & Security

- **Local Storage**: All activity data stored locally by default
- **User Control**: You can review and delete logs anytime
- **Sensitive App Exclusion**: Exclude sensitive applications from logging
- **No Cloud Upload**: Activity data never uploaded without explicit permission

### 📊 Example Output

**Daily Log Example:**
```markdown
# Daily Activity Log

**Date**: 2026-03-09 (Monday)
**Total Active Time**: 8 hours 32 minutes
**Productivity Score**: 87/100 ⭐

## Summary
| Metric | Value |
|--------|-------|
| Work Sessions | 4 |
| Applications Used | 12 |
| Files Modified | 23 |
| Screenshots | 482 |

## Morning Session (09:00 - 12:00)
### Applications
| Application | Time | % |
|-------------|------|---|
| VS Code | 2h 15m | 75% |
| Chrome | 30m | 17% |

## Files Modified Today
- `src/activity_logger.ts` - 09:15
- `README.md` - 11:45
```

### 🚀 Migration from v1.0.0

No breaking changes! All v1.0.0 features continue to work as before.

To start using new features:
```bash
# Start activity monitoring
paleoclaw agent --message "Start monitoring my work session"

# Generate daily log
paleoclaw agent --message "Generate my daily log in Markdown"
```

### 📝 Documentation

- [README.md](README.md) - Project overview
- [PALEOCLAW_IDENTITY.md](PALEOCLAW_IDENTITY.md) - System identity
- [VISION.md](VISION.md) - Project vision
- [CHANGELOG.md](CHANGELOG.md) - Technical changelog (inherited from OpenClaw)

---

## v1.0.0 (2026-03-09) - Initial Release

### 🎉 Overview

Initial release of PaleoClaw, a specialized AI research assistant for paleontology and geosciences.

### ✨ Core Features

#### 1. Literature Search 📄

- Search paleontology papers via CrossRef, Semantic Scholar, arXiv
- Get papers by topic, author, or DOI
- View citation counts and impact metrics
- Access preprints and peer-reviewed articles

#### 2. Fossil Database Queries 🦕

- Query Paleobiology Database (PBDB) for fossil occurrences
- Get taxonomic classifications
- Search by geographic location
- Filter by geological time period

#### 3. Taxonomic Classification 🧬

- Full taxonomic hierarchy lookup
- Support for PBDB and NCBI data
- Classification validation
- Taxonomic name verification

#### 4. Stratigraphy Analysis 📊

- Geological formation data from PBDB
- Stratigraphic column queries
- Age range determination
- Lithology information

#### 5. Research Assistant 🎯

- Comprehensive research workflow
- Literature review automation
- Research report generation
- Data synthesis and analysis

### 🔒 Scientific Integrity

- **No Fabrication**: All data verified against primary sources
- **Verifiable Citations**: Every paper includes DOI
- **Transparent Uncertainty**: Clearly marks disputed data
- **Reproducible**: Documents all queries and parameters

### 📊 Example Usage

```bash
# Literature search
paleoclaw agent --message "Find papers about Jurassic theropods"

# Taxonomy lookup
paleoclaw agent --message "What is the classification of T. rex?"

# Fossil query
paleoclaw agent --message "Query PBDB for Triceratops occurrences"

# Comprehensive research
paleoclaw agent --message "Write a literature review on sauropod gigantism"
```

### 📝 Documentation

- [README.md](README.md) - Project overview
- [PALEOCLAW_IDENTITY.md](PALEOCLAW_IDENTITY.md) - System identity
- [VISION.md](VISION.md) - Project vision

---

## 📚 Citation

If you use PaleoClaw in your research, please cite:

```
PaleoClaw Contributors. (2026). PaleoClaw: An AI Research Agent for
Paleontology. https://github.com/syxscott/PaleoClaw

Data from PBDB: https://paleobiodb.org/
```

---

## 🤝 Contributing

Contributions welcome! Areas of interest:

- New data source integrations
- Additional research skills
- Improved citation formatting
- Non-English language support
- Documentation improvements

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Data from [Paleobiology Database](https://paleobiodb.org/)
- Literature metadata from [CrossRef](https://www.crossref.org/)
- Citation analysis from [Semantic Scholar](https://www.semanticscholar.org/)
- Preprints from [arXiv](https://arxiv.org/)
