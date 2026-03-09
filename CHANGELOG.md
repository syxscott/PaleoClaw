# Changelog

All notable changes to PaleoClaw will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
