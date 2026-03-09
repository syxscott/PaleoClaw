# Activity Monitoring Skills - Implementation Guide

This document explains how to use the activity monitoring scripts for PaleoClaw v1.1.0.

## 📦 Skills Overview

| Skill | Script | Description |
|-------|--------|-------------|
| `screen_monitor` | `capture_screen.sh` | Capture screenshots at intervals |
| `activity_logger` | `log_activity.sh` | Log application usage and file access |
| `daily_log_generator` | `generate_daily_log.sh` | Generate Markdown daily reports |

---

## 🚀 Quick Start

### 1. Screen Monitor

**Capture screenshots continuously:**
```bash
cd PaleoClaw/skills/screen_monitor/scripts
bash capture_screen.sh monitor
```

**Capture single screenshot:**
```bash
bash capture_screen.sh single
```

**Configuration:**
```bash
export SCREEN_MONITOR_INTERVAL=60  # seconds
export SCREEN_MONITOR_DIR="$HOME/paleoclaw-logs/screenshots"
```

---

### 2. Activity Logger

**Start activity logging:**
```bash
cd PaleoClaw/skills/activity_logger/scripts
bash log_activity.sh monitor
```

**Log specific events:**
```bash
# Log current application
bash log_activity.sh log-app

# Log file access
bash log_activity.sh log-file "/path/to/file.txt" "modified"

# Log command execution
bash log_activity.sh log-command "git commit -m 'feat: add feature'"
```

**View summary:**
```bash
bash log_activity.sh summary
```

**Configuration:**
```bash
export ACTIVITY_LOG_DIR="$HOME/paleoclaw-logs/activity"
```

---

### 3. Daily Log Generator

**Generate today's log:**
```bash
cd PaleoClaw/skills/daily_log_generator/scripts
bash generate_daily_log.sh today
```

**Generate for specific date:**
```bash
bash generate_daily_log.sh 2026-03-08
```

**Generate weekly report:**
```bash
bash generate_daily_log.sh weekly
```

**Configuration:**
```bash
export ACTIVITY_LOG_DIR="$HOME/paleoclaw-logs/activity"
export SCREEN_MONITOR_DIR="$HOME/paleoclaw-logs/screenshots"
export DAILY_LOG_OUTPUT_DIR="$HOME/paleoclaw-logs/daily-logs"
```

---

## 📁 Directory Structure

```
~/paleoclaw-logs/
├── screenshots/
│   └── 2026-03-09/
│       ├── screen_09-00-00.png
│       ├── screen_09-01-00.png
│       └── ...
├── activity/
│   ├── activity_2026-03-09.jsonl
│   └── ...
└── daily-logs/
    ├── daily-log_2026-03-09.md
    ├── weekly-log_2026-03-03_to_2026-03-09.md
    └── ...
```

---

## 🔧 System Requirements

### macOS
- `screencapture` (built-in)
- `osascript` (built-in)
- `jq` (install: `brew install jq`)

### Linux
- `imagemagick` (install: `sudo apt install imagemagick`)
- `xdotool` (install: `sudo apt install xdotool`)
- `jq` (install: `sudo apt install jq`)

### Windows
- PowerShell (built-in)
- `jq` (install: `choco install jq`)

---

## 🎯 Complete Workflow Example

### Morning Setup
```bash
# Start screen monitoring in background
cd ~/PaleoClaw/skills/screen_monitor/scripts
bash capture_screen.sh monitor &
SCREEN_PID=$!

# Start activity logging in background
cd ~/PaleoClaw/skills/activity_logger/scripts
bash log_activity.sh monitor &
ACTIVITY_PID=$!

echo "Monitoring started. PIDs: Screen=$SCREEN_PID, Activity=$ACTIVITY_PID"
```

### End of Day
```bash
# Stop monitoring
kill $SCREEN_PID $ACTIVITY_PID

# Generate daily log
cd ~/PaleoClaw/skills/daily_log_generator/scripts
bash generate_daily_log.sh today

# View the log
cat ~/paleoclaw-logs/daily-logs/daily-log_$(date +%Y-%m-%d).md
```

---

## 📊 Output Examples

### Activity Log Entry (JSON)
```json
{
  "timestamp": "2026-03-09T14:30:00Z",
  "type": "application_switch",
  "data": {
    "application": "Visual Studio Code",
    "window": "PaleoClaw - README.md"
  }
}
```

### Daily Log (Markdown)
```markdown
# Daily Activity Log

**Date**: 2026-03-09  
**Time Range**: 09:00:00 - 18:00:00  
**Productivity Score**: 87/100 ⭐

## 📊 Summary

| Metric | Value |
|--------|-------|
| Application Switches | 245 |
| Files Accessed | 42 |
| Commands Executed | 156 |
| Screenshots Captured | 482 |

...
```

---

## 🔒 Privacy & Security

### Data Storage
- All data stored locally by default
- No automatic cloud uploads
- User has full control over data

### Sensitive Data Protection
```bash
# Exclude sensitive applications
export EXCLUDE_APPS="Password Manager,Banking App"

# Auto-delete old data
export AUTO_DELETE_AFTER_DAYS=7
```

### Manual Cleanup
```bash
# Delete all logs
rm -rf ~/paleoclaw-logs/

# Delete specific date
rm -rf ~/paleoclaw-logs/screenshots/2026-03-09
rm ~/paleoclaw-logs/activity/activity_2026-03-09.jsonl
rm ~/paleoclaw-logs/daily-logs/daily-log_2026-03-09.md
```

---

## 🐛 Troubleshooting

### Screen capture fails on macOS
```bash
# Grant screen recording permission
# System Preferences → Security & Privacy → Privacy → Screen Recording
# Add Terminal or your shell app
```

### Activity logger not detecting apps on Linux
```bash
# Install xdotool
sudo apt install xdotool

# Test
xdotool getactivewindow getwindowname
```

### jq command not found
```bash
# macOS
brew install jq

# Linux
sudo apt install jq

# Windows
choco install jq
```

---

## 📚 Integration with PaleoClaw

These scripts are designed to be called by PaleoClaw Skills. When using through PaleoClaw:

```bash
# Via PaleoClaw agent
paleoclaw agent --message "Start monitoring my screen activity"
paleoclaw agent --message "Generate my daily log"
paleoclaw agent --message "What have I been working on today?"
```

---

## 🔄 Automation

### Cron Job (Linux/macOS)
```bash
# Start monitoring at 9 AM
0 9 * * * cd ~/PaleoClaw/skills/screen_monitor/scripts && bash capture_screen.sh monitor &

# Generate daily log at 6 PM
0 18 * * * cd ~/PaleoClaw/skills/daily_log_generator/scripts && bash generate_daily_log.sh today
```

### Task Scheduler (Windows)
Create scheduled tasks to run the scripts at desired times.

---

## 📝 Notes

- Scripts require Bash shell (Git Bash on Windows)
- Adjust intervals based on your needs and disk space
- Review and delete sensitive captures regularly
- Combine all three skills for comprehensive tracking

---

*Part of PaleoClaw v1.1.0 Activity Monitoring System*  
*"Ex Fossilo, Scientia" - From Fossils, Knowledge*
