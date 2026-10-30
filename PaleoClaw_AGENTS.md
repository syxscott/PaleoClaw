# PaleoClaw Developer Guide

## 🦕 PaleoClaw 开发指南

This document provides guidelines for developing and extending PaleoClaw.

---

## Project Structure

```
PaleoClaw/
├── src/paleoclaw/           # Core PaleoClaw modules
│   ├── profile/            # Profile system (soul.md + user.md)
│   ├── memory/             # Memory system (short/long term + retrieval)
│   ├── tools/              # Domain tool registry (PBDB, CrossRef, literature)
│   ├── session/            # Session store (SQLite with JSON fallback)
│   ├── integration/        # Runtime switches
│   ├── cli/                # CLI commands
│   ├── paths.ts            # Shared path resolution
│   └── index.ts            # Module exports
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
import { loadSessionProfile, buildProfileContextBlock } from "./paleoclaw/profile";

// Synchronous: returns the parsed profile for the current workspace.
const profile = loadSessionProfile();

// Renders the fenced <paleoclaw-profile-context> block that is prepended to
// every agent run.
const block = buildProfileContextBlock(profile);
```

**Public API (`layers.ts`):**

- `loadSessionProfile(workspaceRoot?, forceReload?): SessionProfile` - load and cache the
  merged `soul.md` + `user.md` profile.
- `buildProfileContextBlock(profile): string` - render the profile as a fenced context block.
- `parseSoul(markdown): SoulConfig` / `parseUser(markdown): UserProfile` - parse one layer.
- `ensureProfileLayers(workspaceRoot?)` - create the profile files when they are missing.
- `splitSections(markdown)` / `sectionItems(sections, ...aliases)` - section parsing helpers.
- `clearProfileCache(workspaceRoot?)` / `getProfileCache(workspaceRoot?)` - cache control.
- `plannerContext(profile)` / `toolRouterContext(profile)` / `reportContext(profile)` /
  `memoryContext(profile)` - per-module views over the profile.

### Memory System (`src/paleoclaw/memory/`)

The memory system provides research trajectory tracking:

- Short-term memory: Current research tasks
- Long-term memory: Reviewed insights
- Vector search: Content similarity retrieval
- Chat digests: Per-day, per-session conversation summaries

**Key Files:**

- `store.ts` - Memory storage implementation (`TaskMemoryStore`)
- `retrieval.ts` - Vector-based search
- `provider.ts` / `manager.ts` - Provider registry and lifecycle
- `index.ts` - Module exports

**Usage:**

```typescript
import { TaskMemoryStore } from "./paleoclaw/memory";

const store = new TaskMemoryStore();

const taskId = store.startTask("agent", ["--message", "hello"], process.cwd());
store.finishTask(taskId, 0);

// Recall: scope is "short" | "long" | "archive" | "all".
const results = store.searchMemory({ query: "tyrannosaurus", scope: "all" });
```

**Public API (`TaskMemoryStore`):**

- `startTask(command, argv, cwd): string` - open a short-term task record.
- `finishTask(taskId, returnCode, error?, extra?): TaskMemory` - close the record.
- `recordChatTurn({ sessionId, userText, assistantText, intent?, mode?, ts? }): void` - fold
  one chat turn into the session day file.
- `autoReviewToLong(taskId): LongTermMemory` / `reviewTaskToLong(taskId, summary?, lessons?,
  nextActions?): LongTermMemory` - promote a task to long-term memory.
- `getShort(taskId): TaskMemory` - read one task.
- `listShort({ limit?, status? }): TaskMemory[]` / `listLong({ limit? }): LongTermMemory[]` /
  `listArchiveShort({ limit?, status? }): TaskMemory[]` - list the stores.
- `archiveShort({ beforeDays?, status?, includeRunning? })` - archive finished tasks.
- `searchMemory({ query, scope?, topK?, minScore? }): SearchItem[]` - vector search.
- `countShort(): number` / `countLong(): number` / `getStatus()` - counters and paths.
- `listChatDaily(days?): ChatDailyRecord[]` / `getChatDailyDigest(day): ChatDigest | null` -
  chat digests.

**Retrieval helpers (`retrieval.ts`):**

- `bestMatches(query, items, topK?): SearchItem[]` - rank items by similarity.
- `calculateSimilarity(textA, textB): number` - cosine similarity of two texts.

---

## Research Skills

### Creating a New Skill

Skills are located in `skills/<skill-name>/`.

**Required Files:**

- `SKILL.md` - Skill definition and instructions

A skill is any directory under a skills root that contains a `SKILL.md`; that file is the
only required artefact. A skill that needs executable code may ship extra files next to
it (for example `index.ts` plus a `lib/` folder, as `morphometric_analysis` does), but
there is no fixed name for that code and the loader does not look for one.

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

`skills/` ships roughly 70 skills in total, most of them general-purpose. The
paleontology core ones are:

| Skill                    | Description                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| `paper_search`           | Literature search via CrossRef/Semantic Scholar/arXiv                |
| `paper_summary`          | Structured summary of a paper (background/methods/results)           |
| `pbdb_query`             | PBDB fossil occurrence, taxonomy and geological queries              |
| `taxonomy_lookup`        | Taxonomic classification lookup (PBDB, NCBI/Wikidata)                |
| `stratigraphy_lookup`    | Geological formation data                                            |
| `geo-time-scale`         | Geological time scale lookups (eon/era/period/epoch)                 |
| `morphometric_analysis`  | Landmark extraction and geometric morphometrics (TPS/CSV/Excel/JSON) |
| `morphometric-converter` | Morphometric data format conversion (TPS/NTsys/Excel/CSV)            |
| `research_assistant`     | Paleontology research workflow chaining the tools above              |
| `china-fossil-news`      | Chinese fossil discoveries and news aggregation                      |

Only `morphometric_analysis` ships code (`index.ts` plus `lib/`); the others are
`SKILL.md` only.

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
pnpm test -- <test-name>
```

---

## Version

PaleoClaw v2026.10.5
