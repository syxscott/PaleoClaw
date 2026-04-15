# PaleoClaw Developer Guide

## 🦕 PaleoClaw 开发指南

This document provides guidelines for developing and extending PaleoClaw.

---

## Project Structure

```
PaleoClaw/
├── src/paleoclaw/           # Core PaleoClaw modules
│   ├── profile/             # Profile system
│   ├── memory/             # Memory system
│   └── cli/                # CLI commands
├── skills/                 # Research skills
├── extensions/             # Channel extensions
├── scripts/                # Utility scripts
└── docs/                   # Documentation
```

---

## Core Modules

### Profile System (`src/paleoclaw/profile/`)

The profile system provides double-layer personalization:

- `soul.md` - System-level identity and principles
- `user.md` - User-level research preferences

**Key Files:**
- `layers.ts` - Profile parser and loader
- `index.ts` - Module exports

**Usage:**
```typescript
import { loadProfileLayers, createProfileContext } from './paleoclaw/profile';

const profile = await loadProfileLayers();
const context = createProfileContext(profile);
```

### Memory System (`src/paleoclaw/memory/`)

The memory system provides research trajectory tracking:

- Short-term memory: Current research tasks
- Long-term memory: Reviewed insights
- Vector search: Content similarity retrieval

**Key Files:**
- `store.ts` - Memory storage implementation
- `retrieval.ts` - Vector-based search
- `index.ts` - Module exports

**Usage:**
```typescript
import { MemoryStore } from './paleoclaw/memory';

const store = new MemoryStore();
await store.saveShortTermMemory(task);
const results = await store.searchLongTerm(query);
```

---

## Research Skills

### Creating a New Skill

Skills are located in `skills/<skill-name>/`.

**Required Files:**
- `SKILL.md` - Skill definition and instructions
- `skill.ts` - Skill implementation

**SKILL.md Template:**
```markdown
# Skill Name

## Purpose
Brief description of the skill's purpose.

## Usage
How to use the skill.

## Examples
Example queries and responses.
```

### Existing Skills

| Skill | Description |
|-------|-------------|
| `paper_search` | Literature search via CrossRef/Semantic Scholar |
| `pbdb_query` | PBDB fossil occurrence queries |
| `taxonomy_lookup` | Taxonomic classification lookup |
| `stratigraphy_lookup` | Geological formation data |
| `morphometric_analysis` | Landmark extraction and analysis |

---

## Scientific Integrity

### Data Verification Standards

1. **Taxonomic names** must be verified via PBDB
2. **Paper citations** must include valid DOI
3. **Age ranges** must include uncertainty (in Ma)
4. **Disputed claims** must be clearly marked
5. **Data sources** must be explicitly cited

### Quality Assurance Checklist

Before delivering any scientific claim:

- [ ] Verified against primary database (PBDB/CrossRef)
- [ ] Taxonomic name validity confirmed
- [ ] Paper DOI validated
- [ ] Age range includes uncertainty
- [ ] Disputed interpretations noted
- [ ] Data source explicitly cited

---

## Code Style

- TypeScript (ESM)
- Strict typing
- Meaningful variable names
- Comprehensive comments for complex logic
- Follow existing patterns in the codebase

---

## Testing

Run tests:
```bash
pnpm test
```

Run specific tests:
```bash
pnpm test --filter <test-name>
```

---

## Version

PaleoClaw v1.6.0
