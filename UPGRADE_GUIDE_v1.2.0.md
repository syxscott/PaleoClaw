# Upgrade Guide: PaleoClaw v1.1.0 to v1.2.0

This guide will help you upgrade from PaleoClaw v1.1.0 to v1.2.0, which introduces the new **Profile Layers** and **Memory System** features.

---

## What's New in v1.2.0

### 🧬 Profile Layers System
- **Soul Layer** (`soul.md`): System identity, scientific principles, safety boundaries
- **User Layer** (`user.md`): Personal research preferences, output habits, workflow settings
- Double-layer architecture adapted from GeoClaw-OpenAI v2.4.0

### 🧠 Memory System
- **Short-term Memory**: Automatic recording of research tasks
- **Long-term Memory**: Reviewed and summarized research insights
- **Vector Search**: Find past research by content similarity
- **Archive**: Automatic cleanup of old memories

---

## Upgrade Steps

### Step 1: Update PaleoClaw

```bash
npm install -g paleoclaw@latest
# or
pnpm add -g paleoclaw@latest
```

Verify the update:
```bash
paleoclaw --version
# Should show: 1.2.0
```

### Step 2: Initialize Profile Layers

Run the profile initialization command:

```bash
paleoclaw profile init
```

This will create:
- `~/.paleoclaw/soul.md` - System identity and principles
- `~/.paleoclaw/user.md` - User preferences (with defaults)

### Step 3: Customize Your User Profile

Edit `~/.paleoclaw/user.md` to match your research preferences:

```bash
# Using your favorite editor
nano ~/.paleoclaw/user.md
# or
vim ~/.paleoclaw/user.md
# or
code ~/.paleoclaw/user.md
```

Key sections to customize:

1. **Identity** - Your role, domain, institution
2. **Research Focus** - Your primary interests, preferred periods/regions
3. **Language Preference** - Output language preference
4. **Data Preferences** - Default limits, citation format
5. **Preferred Journals** - Journals you frequently cite

Example customization:

```markdown
## Identity
Role: PhD candidate
Domain: theropod paleontology, dinosaur biomechanics
Institution: Your University

## Research Focus
Primary interests:
- Tyrannosauridae
- Dromaeosauridae
- Feathers and flight origins

Preferred geological periods:
- Late Cretaceous
- Early Cretaceous

Preferred regions:
- Mongolia
- China (Liaoning)
- North America
```

### Step 4: Verify Profile Configuration

Check your profile:

```bash
paleoclaw profile show
```

Or with JSON output:

```bash
paleoclaw profile show --json
```

### Step 5: Initialize Memory System

Check memory status:

```bash
paleoclaw paleo-memory status
```

This will show:
- Short-term memory count
- Long-term memory count
- Storage locations

### Step 6: Test Memory Features

Try the memory commands:

```bash
# List short-term memories
paleoclaw paleo-memory short

# List long-term memories
paleoclaw paleo-memory long

# Search memories (will be empty initially)
paleoclaw paleo-memory search "theropod"
```

---

## File Changes

### New Files Created

| File | Location | Purpose |
|------|----------|---------|
| `soul.md` | `~/.paleoclaw/soul.md` | System identity |
| `user.md` | `~/.paleoclaw/user.md` | User preferences |
| Memory storage | `~/.paleoclaw/memory/` | Research memories |

### Deprecated Files

| File | Status | Notes |
|------|--------|-------|
| `PALEOCLAW_IDENTITY.md` | Deprecated | Content migrated to `soul.md` |

---

## Environment Variables

New environment variables for v1.2.0:

```bash
# Optional: Custom profile paths
export PALEOCLAW_SOUL_PATH=/path/to/custom/soul.md
export PALEOCLAW_USER_PATH=/path/to/custom/user.md

# Optional: Custom home directory
export PALEOCLAW_HOME=/path/to/custom/paleoclaw/home
```

Add these to your `~/.bashrc`, `~/.zshrc`, or equivalent.

---

## CLI Commands Reference

### Profile Commands

```bash
# Initialize profile layers
paleoclaw profile init

# Show current profile
paleoclaw profile show
paleoclaw profile show --json
```

### Memory Commands

```bash
# Show memory status
paleoclaw paleo-memory status
paleoclaw paleo-memory status --json

# List short-term memories
paleoclaw paleo-memory short
paleoclaw paleo-memory short --limit 10
paleoclaw paleo-memory short --status success

# List long-term memories
paleoclaw paleo-memory long
paleoclaw paleo-memory long --limit 5

# Search memories
paleoclaw paleo-memory search "theropod"
paleoclaw paleo-memory search "Jurassic China" --scope all --top-k 10

# Archive old memories
paleoclaw paleo-memory archive
paleoclaw paleo-memory archive --before-days 14

# Review a task
paleoclaw paleo-memory review <task-id>
paleoclaw paleo-memory review <task-id> --summary "Custom summary"
```

---

## Troubleshooting

### Profile Not Loading

If `paleoclaw profile show` shows default values:

1. Check if files exist:
   ```bash
   ls -la ~/.paleoclaw/soul.md ~/.paleoclaw/user.md
   ```

2. Reinitialize:
   ```bash
   paleoclaw profile init
   ```

3. Check environment variables:
   ```bash
   echo $PALEOCLAW_SOUL_PATH
   echo $PALEOCLAW_USER_PATH
   ```

### Memory Commands Not Found

If `paleoclaw paleo-memory` is not recognized:

1. Verify version:
   ```bash
   paleoclaw --version
   ```

2. Check if CLI module is loaded (may require rebuild):
   ```bash
   npm rebuild -g paleoclaw
   ```

### Permission Errors

If you get permission errors:

```bash
# Fix permissions
chmod 755 ~/.paleoclaw
chmod 644 ~/.paleoclaw/soul.md ~/.paleoclaw/user.md
```

---

## Best Practices

### Profile Management

1. **Keep soul.md minimal** - Only edit if you need to change core principles
2. **Customize user.md** - This is where your personal preferences go
3. **Version control** - Consider tracking your user.md in a private repo
4. **Backup** - Keep backups of your profile files

### Memory Management

1. **Regular archives** - Run `paleoclaw paleo-memory archive` weekly
2. **Review important tasks** - Promote significant research to long-term memory
3. **Use search** - Find related research with `paleoclaw paleo-memory search`
4. **Clean up** - Archive or delete old memories to save space

---

## Getting Help

If you encounter issues:

1. Check the [CHANGELOG.md](CHANGELOG.md) for known issues
2. Review the [README.md](README.md) for documentation
3. Open an issue on GitHub: https://github.com/syxscott/PaleoClaw/issues

---

## Summary

PaleoClaw v1.2.0 brings powerful new features for personalized research:

- ✅ **Profile Layers** - Tailor PaleoClaw to your research style
- ✅ **Memory System** - Never lose track of your research history
- ✅ **Vector Search** - Find related research instantly

Enjoy your upgraded PaleoClaw experience!

---

*For more information, see the full documentation in [README.md](README.md)*
