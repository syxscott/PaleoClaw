---
name: activity_logger
description: "Log computer activities including applications used, files accessed, websites visited, and commands executed. Creates structured activity logs for productivity tracking and daily reports."
homepage: https://github.com/syxscott/PaleoClaw
metadata:
  {
    "paleoclaw":
      {
        "emoji": "📝",
        "requires": { "bins": [] },
        "os": ["darwin", "linux", "win32"],
        "install": [],
      },
  }
---

# Activity Logger Skill

Log and track computer activities for productivity monitoring and daily reports.

## When to Use

✅ **USE this skill when:**

- "Log my work activity"
- "Track what I'm working on"
- "Record my computer usage"
- "Monitor my productivity"
- "Create activity timeline"
- "Remember what I did today"

## When NOT to Use

❌ **DON'T use this skill when:**

- Handling sensitive data
- Private browsing sessions
- Confidential work
- Password entry

## Data Sources

### macOS
- System logs via `log show`
- Application switching via AppleScript
- File access via `.DS_Store` and recent items
- Browser history (with permission)

### Linux
- Shell history (`~/.bash_history`, `~/.zsh_history`)
- Recent files (`~/.local/share/recently-used.xbel`)
- Process accounting

### Windows
- Event Viewer logs
- Recent files
- Shell history

## Commands

### Start Activity Logging

```bash
# Initialize activity logger
paleoclaw agent --message "Start logging my computer activity"
```

### View Current Session

```bash
# Show current activity log
paleoclaw agent --message "What have I been doing this session?"
```

### Export Activity Log

```bash
# Export to JSON
paleoclaw agent --message "Export my activity log to JSON"

# Export to Markdown
paleoclaw agent --message "Export my activity log to Markdown"
```

## Response Format

### Activity Log Entry

```json
{
  "timestamp": "2026-03-09T14:30:00Z",
  "type": "application_switch",
  "application": "Visual Studio Code",
  "file": "/path/to/file.ts",
  "duration_seconds": 1800,
  "tags": ["coding", "development"]
}
```

### Activity Summary

```
**Activity Log: 2026-03-09**

**Session 1**: 09:00 - 12:00 (3 hours)

**Applications Used**:
- Visual Studio Code: 2h 15m
- Chrome: 45m
- Terminal: 30m
- Slack: 15m

**Files Modified**:
1. src/index.ts - 10:30
2. src/utils.ts - 11:15
3. README.md - 11:45

**Websites Visited**:
- github.com (15 visits)
- stackoverflow.com (8 visits)
- docs.python.org (5 visits)

**Commands Executed**: 47
- git commit: 8
- npm run build: 5
- paleoclaw agent: 12

**Productivity Score**: 85/100
```

## Configuration

### Logging Settings

```json
{
  "activity_logger": {
    "enabled": true,
    "log_applications": true,
    "log_files": true,
    "log_websites": true,
    "log_commands": true,
    "log_interval_seconds": 30,
    "storage_path": "~/paleoclaw-logs/activity",
    "retention_days": 30,
    "exclude_applications": [
      "Password Manager",
      "Banking App",
      "Private Browser"
    ],
    "exclude_websites": [
      "bank.com",
      "email.com"
    ]
  }
}
```

### Privacy Filters

```json
{
  "privacy": {
    "blur_passwords": true,
    "exclude_incognito": true,
    "exclude_private_windows": true,
    "anonymize_urls": false
  }
}
```

## Output Formats

### JSON Format

```json
{
  "date": "2026-03-09",
  "sessions": [
    {
      "start": "09:00:00",
      "end": "12:00:00",
      "activities": [
        {
          "time": "09:00",
          "type": "app_launch",
          "name": "Visual Studio Code",
          "details": "Opened project: PaleoClaw"
        }
      ]
    }
  ],
  "summary": {
    "total_hours": 3,
    "productive_hours": 2.5,
    "applications_count": 4,
    "files_modified": 3
  }
}
```

### Markdown Format

```markdown
# Daily Activity Log

**Date**: 2026-03-09  
**Total Time**: 8 hours 30 minutes  
**Productivity Score**: 85/100

## Morning Session (09:00 - 12:00)

### Applications
| Application | Time | Percentage |
|-------------|------|------------|
| VS Code | 2h 15m | 75% |
| Chrome | 45m | 25% |

### Files Modified
1. `src/index.ts` - 10:30
2. `src/utils.ts` - 11:15

### Commands
```bash
git commit -m "feat: add activity logger"
npm run build
```

## Afternoon Session (13:00 - 17:30)
...
```

## Scientific Integrity Rules

⚠️ **CRITICAL**:

- Always obtain user consent before logging
- Store logs locally by default
- Never upload without permission
- Provide easy opt-out
- Allow log deletion
- Respect privacy settings
- Exclude sensitive applications

## Integration

### With screen_monitor

```bash
# Combined monitoring
paleoclaw agent --message "Start screen monitoring and activity logging"
```

### With daily_log_generator

```bash
# Generate daily report
paleoclaw agent --message "Generate my daily activity report"
```

## Example Usage

### Start Logging

```bash
paleoclaw agent --message "Start logging my work activity for today"
```

### Check Progress

```bash
paleoclaw agent --message "How productive have I been today?"
```

### End Session

```bash
paleoclaw agent --message "Stop logging and show me my activity summary"
```

## Notes

- Logs are stored in `~/paleoclaw-logs/activity/`
- Default retention: 30 days
- Can be combined with screen_monitor for comprehensive tracking
- Markdown export is highly readable
