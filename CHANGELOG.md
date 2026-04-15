# Changelog

All notable changes to PaleoClaw will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.6.0] - 2026-04-15

### 🚀 Added

#### Tool System (Hermes-style integration)
- Added a centralized PaleoClaw tool registry with typed tool metadata and execution results
- Added built-in tool discovery/loading flow
- Added built-in research tools:
  - `pbdb_query`
  - `crossref_search`
  - `literature_summary`
- Added CLI command group:
  - `paleoclaw paleo-tools list`
  - `paleoclaw paleo-tools run <tool-name> --params '{...}'`

#### Memory Manager (Provider + Fenced Context)
- Added `MemoryProvider` abstraction
- Added `MemoryManager` orchestration with provider lifecycle
- Added fenced memory-context injection format (`<memory-context>...</memory-context>`)
- Added memory context CLI command:
  - `paleoclaw paleo-memory context "<query>"`

#### Session Management
- Added `SessionStore` for local PaleoClaw session history persistence
- Added session upsert support for stable session IDs from agent runtime
- Added CLI command group:
  - `paleoclaw paleo-session new`
  - `paleoclaw paleo-session list`
  - `paleoclaw paleo-session show`
  - `paleoclaw paleo-session search`
  - `paleoclaw paleo-session resume`

### 🔧 Changed

- Integrated memory prefetch/sync and session autosave into `agent` command execution path
- Added automatic pre-run tool context injection for PBDB/CrossRef intent prompts
- Added runtime integration switches via environment variables:
  - `PALEOCLAW_ENABLE_AUTO_TOOLS`
  - `PALEOCLAW_ENABLE_MEMORY_CONTEXT`
  - `PALEOCLAW_ENABLE_SESSION_AUTOSAVE`

### ✅ Quality

- Added focused tests for:
  - tool registry behavior
  - memory manager fencing/provider rules
  - session store CRUD/search/upsert
  - runtime integration switches

## [1.5.0] - 2026-04-14

### 🔧 Updated

#### OpenClaw Base
- **Updated from OpenClaw (downloaded 2026.3.8 → 2026.4.14)**
  - Bumped all dependencies to latest versions
  - Added new plugin-sdk exports
  - Updated TypeScript to 6.x
  - Updated Node.js requirement to >=22.14.0
  - Updated pnpm to 10.32.1

#### Dependencies Upgraded
- @agentclientprotocol/sdk: 0.15.0 → 0.18.2
- @mariozechner/*: 0.55.3 → 0.66.1
- @buape/carbon: beta → 0.15.0
- oxlint: ^1.51.0 → ^1.59.0
- oxfmt: 0.36.0 → 0.44.0
- vitest: ^4.0.18 → ^4.1.4

#### New Dependencies Added
- @anthropic-ai/vertex-sdk, @google/genai, hono
- @lancedb/lancedb, @modelcontextprotocol/sdk
- matrix-js-sdk, openai, uuid, jimp
- And 20+ other new packages

## [1.4.0] - 2026-03-14

### 🔧 Improvements

#### CLI Integration
- **Wired PaleoClaw profile/memory commands into main CLI registry**
  - Added top-level `profile` command registration
  - Added top-level `paleo-memory` command registration
  - Aligned runtime behavior with README command documentation

#### Morphometric Analysis Consistency
- **Fixed processing options key mismatch**
  - Replaced `numSemilandmarks` with `numLandmarks` in image processor defaults
  - Aligned implementation with type definitions and runtime config
- **Fixed visualization color option mismatch**
  - Standardized on `landmarkColor` in skill default config
  - Removed non-functional `fixedColor` / `semilandmarkColor` defaults
- **Improved landmark link generation**
  - Landmark link builder now supports dynamic landmark counts
  - Visualization now generates links based on actual landmark length

#### Export Behavior
- **Fixed Excel export output path consistency**
  - `excel` export now writes to the requested `.xlsx` output path directly
  - Removed implicit rewrite to `.csv` filename

#### Tooling and Versioning
- **Added missing `tsgo` script** in `package.json` (`tsc --noEmit`) to keep `pnpm check` runnable
- **Bumped project version to `1.4.0`**

## [1.3.1] - 2026-03-11

### 🐛 Bug Fixes

#### Markdown Processing
- **Fixed Quote Block Spacing Issue**: Resolved issue where blockquotes followed by paragraphs produced triple newlines (`\n\n\n`) instead of standard double newlines (`\n\n`)
  - Fixed `blockquote_close` processor to not add extra spacing since container blocks shouldn't add their own spacing
  - Inner content (paragraphs, headings, etc.) already provides proper block separation

#### Auto-reply System
- **Fixed Input State Persistence**: Resolved issue where typing loop would restart after `markRunComplete()` was called
  - Added check for `runComplete` flag in `triggerTyping` function to prevent typing restart after completion
  - Ensures typing indicators don't appear unnecessarily after run completion

#### Web Compatibility
- **Fixed Global Event Object Dependency**: Removed dependency on global `event` object in tab switching functionality
  - Updated `showTab` function to only use explicitly passed button element parameter
  - Improves compatibility with strict mode and various browsers

### 🔧 Improvements

#### Debugging System
- **Unified Debug Configuration**: Created centralized debug configuration system to replace scattered environment variables
  - Introduced `DebugConfig` interface with standardized categories
  - Added helper functions: `loadDebugConfig()`, `getDebugConfig()`, `isDebugEnabled()`
  - Migrated multiple modules to use unified system: Telegram accounts, memory embeddings, health checks, NextCloud Talk

#### Testing
- **Improved Test Data Readability**: Replaced hard-coded test values with meaningful constants in session tests
  - Added `TEST_SLACK_CHANNEL_ID`, `TEST_THREAD_ID`, and `TEST_ACCOUNT_ID` constants
  - Enhanced test maintainability and clarity

---

## [1.2.0] - 2026-03-09

### 🆕 New Features

#### Profile Layers System (from GeoClaw-OpenAI v2.4.0)
- **Soul/User Double-Layer Architecture**: Separated system identity from user preferences
  - `soul.md`: System-level identity, core principles, data source hierarchy, safety boundaries
  - `user.md`: User-level research preferences, output habits, workflow settings
- **Profile CLI Commands**:
  - `paleoclaw profile init` - Initialize profile layers in `~/.paleoclaw/`
  - `paleoclaw profile show` - Display current profile configuration
- **Profile Context Integration**: Profile information injected into planner, tool router, report generator, and memory manager

#### Memory System (from GeoClaw-OpenAI v2.4.0)
- **Short-term Memory**: Automatic recording of each research task with parameters, status, and results
- **Long-term Memory**: Reviewed and summarized research insights with lessons learned
- **Vector-based Search**: Similarity search using MD5 hash vectors for content retrieval
- **Archive System**: Automatic cleanup of old short-term memories
- **Memory CLI Commands**:
  - `paleoclaw paleo-memory status` - Show memory store statistics
  - `paleoclaw paleo-memory short` - List short-term memories
  - `paleoclaw paleo-memory long` - List long-term memories
  - `paleoclaw paleo-memory search <query>` - Search memories by content similarity
  - `paleoclaw paleo-memory archive` - Archive old memories
  - `paleoclaw paleo-memory review <task-id>` - Review and promote to long-term

### 📁 New Files

#### Core Modules (`src/paleoclaw/`)
- `src/paleoclaw/profile/layers.ts` - Profile layer parser and loader
- `src/paleoclaw/profile/index.ts` - Profile module exports
- `src/paleoclaw/memory/store.ts` - Task memory store implementation
- `src/paleoclaw/memory/retrieval.ts` - Vector-based similarity search
- `src/paleoclaw/memory/index.ts` - Memory module exports
- `src/paleoclaw/cli/profile-cli.ts` - Profile CLI commands
- `src/paleoclaw/cli/memory-cli.ts` - Memory CLI commands
- `src/paleoclaw/cli/index.ts` - CLI exports
- `src/paleoclaw/index.ts` - Main module exports

#### Configuration Files
- `soul.md` - System identity and principles (new format)
- `user.md` - User preferences and research focus (new)

### 🔧 Technical Details

#### Profile System
- Environment variable support: `PALEOCLAW_SOUL_PATH`, `PALEOCLAW_USER_PATH`
- Default location: `~/.paleoclaw/soul.md` and `~/.paleoclaw/user.md`
- Structured parsing with section extraction
- Context builders for different modules (planner, router, report, memory)

#### Memory System
- Storage location: `~/.paleoclaw/memory/`
- Short-term: `short/*.json` files
- Long-term: `long_term.jsonl` append-only file
- Archive: `archive/short/` directory
- Vector dimension: 384
- Similarity metric: Cosine similarity
- Default min score: 0.15

### 📝 Notes

- Adapted from GeoClaw-OpenAI v2.4.0 profile and memory systems
- JSON-based storage for human readability
- TypeScript implementation for Node.js compatibility
- Profile layers provide personalized research experience
- Memory system enables research trajectory tracking

---

## [1.1.0] - 2026-03-09

### 🆕 New Features

#### Activity Monitoring
- **Screen Monitor** - Capture screenshots and monitor screen activity
- **Activity Logger** - Log applications, files, websites, and commands
- **Daily Log Generator** - Generate comprehensive daily logs in Markdown format

#### Features
- Real-time computer activity tracking
- Productivity analysis and metrics
- File location tracking
- Daily/weekly report generation
- Privacy-focused local storage

### 📁 New Skills
- `screen_monitor` - Screen capture and monitoring
- `activity_logger` - Activity logging
- `daily_log_generator` - Daily log generation

---

## [1.0.0] - 2026-03-09

### 🆕 Initial Release

#### Core Features
- **Paper Search** - Search paleontology papers via CrossRef, Semantic Scholar, arXiv
- **PBDB Query** - Query fossil occurrences from Paleobiology Database
- **Taxonomy Lookup** - Taxonomic classification from PBDB, NCBI
- **Stratigraphy Lookup** - Geological formation data from PBDB
- **Paper Summary** - Structured paper summaries with AI analysis
- **Research Assistant** - Comprehensive research workflow integration

#### Data Sources
- Paleobiology Database (PBDB)
- CrossRef
- Semantic Scholar
- arXiv

#### Scientific Integrity
- No fabrication - All data verified against primary sources
- Verifiable citations - Every paper includes DOI
- Transparent uncertainty - Clearly marks disputed data
- Reproducible - Documents all queries and parameters

---

## Migration Guides

### Upgrading from v1.1.0 to v1.2.0

1. **Initialize Profile Layers**:
   ```bash
   paleoclaw profile init
   ```

2. **Customize Your Profile**:
   - Edit `~/.paleoclaw/soul.md` for system-level preferences
   - Edit `~/.paleoclaw/user.md` for personal research preferences

3. **Start Using Memory**:
   ```bash
   paleoclaw paleo-memory status
   ```

4. **Legacy File**:
   - `PALEOCLAW_IDENTITY.md` is now deprecated in favor of `soul.md`
   - Content has been migrated to the new format

---

*For detailed documentation, see [README.md](README.md) and [docs/](docs/)*
