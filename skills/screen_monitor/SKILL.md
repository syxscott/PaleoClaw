---
name: screen_monitor
description: "Monitor screen activity and capture screenshots at intervals. Use when: tracking work sessions, documenting workflow, creating visual activity logs. Captures screenshots and generates activity summaries."
homepage: https://github.com/syxscott/PaleoClaw
metadata:
  {
    "paleoclaw":
      {
        "emoji": "🖥️",
        "requires": { "bins": ["screencapture", "import"] },
        "os": ["darwin", "linux", "win32"],
        "install":
          [
            {
              "id": "macos-builtin",
              "kind": "system",
              "label": "macOS screencapture (built-in)",
              "bins": ["screencapture"],
            },
            {
              "id": "linux-imagemagick",
              "kind": "apt",
              "package": "imagemagick",
              "bins": ["import"],
              "label": "Install ImageMagick (Linux)",
            },
          ],
      },
  }
---

# Screen Monitor Skill

Monitor screen activity and capture screenshots at regular intervals.

## When to Use

✅ **USE this skill when:**

- "Start monitoring my screen activity"
- "Capture my work session"
- "Track what I'm doing on the computer"
- "Create visual log of my activity"
- "Document my workflow"
- "Remember what files I worked with"

## When NOT to Use

❌ **DON'T use this skill when:**

- Handling sensitive/confidential information
- Video calls with other people
- Banking or password entry
- Private communications

## Commands

### Start Monitoring

```bash
# Start screen monitoring (macOS)
screencapture -x -T 5 -t 60 ~/paleoclaw-screenshots/screen_

# Start screen monitoring (Linux)
import -window root -pause 60 ~/paleoclaw-screenshots/screen_%d.png

# Start screen monitoring (Windows)
# Use PowerShell screenshot capture
```

### Capture Single Screenshot

```bash
# macOS
screencapture -x ~/paleoclaw-screenshots/manual_$(date +%Y%m%d_%H%M%S).png

# Linux
import -window root ~/paleoclaw-screenshots/manual_$(date +%Y%m%d_%H%M%S).png
```

### Stop Monitoring

```bash
# Kill monitoring process
pkill -f screencapture
pkill -f import
```

## Response Format

```
**Screen Monitoring Session**

**Session ID**: [timestamp]
**Start Time**: HH:MM:SS
**End Time**: HH:MM:SS
**Duration**: X hours Y minutes

**Screenshots Captured**: N images
**Storage Location**: ~/paleoclaw-screenshots/YYYY-MM-DD/

**Activity Summary**:
- Most active application: [App Name]
- Files accessed: [List]
- Websites visited: [List]

**Privacy Note**: Screenshots are stored locally and never uploaded without permission.
```

## Configuration

### Monitoring Interval

- **Default**: 60 seconds
- **Recommended**: 30-120 seconds
- **High frequency**: 10-30 seconds (more storage)

### Storage Location

```
~/paleoclaw-logs/
├── screenshots/
│   └── YYYY-MM-DD/
│       ├── screen_HH_MM_SS.png
│       └── ...
└── logs/
    └── activity_YYYY-MM-DD.json
```

### Privacy Settings

```json
{
  "screen_monitor": {
    "enabled": true,
    "interval_seconds": 60,
    "storage_path": "~/paleoclaw-logs/screenshots",
    "auto_delete_after_days": 7,
    "blur_sensitive_areas": false,
    "exclude_applications": ["Password Manager", "Banking App"]
  }
}
```

## Scientific Integrity Rules

⚠️ **CRITICAL**:

- Always respect user privacy
- Never capture without explicit permission
- Store screenshots locally by default
- Allow user to review before sharing
- Provide easy delete/clear options
- Exclude sensitive applications

## Example Usage

### Start Work Session Logging

```bash
paleoclaw agent --message "Start monitoring my screen activity for this work session"
```

### Generate Activity Summary

```bash
paleoclaw agent --message "What have I been working on for the past 2 hours?"
```

### Find Specific File

```bash
paleoclaw agent --message "Which file was I editing at 3 PM yesterday?"
```

## Notes

- Screenshots consume disk space (~1-5 MB each)
- Consider using lower frequency for long sessions
- Review and delete sensitive captures
- Combine with activity_logger for comprehensive logs
