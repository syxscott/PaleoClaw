#!/bin/bash
# Activity Logger - Computer Activity Tracking Script
# Part of PaleoClaw Activity Monitoring System

set -e

# Configuration
LOG_DIR=${ACTIVITY_LOG_DIR:-"$HOME/paleoclaw-logs/activity"}
DATE=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/activity_${DATE}.jsonl"

# Create log directory
mkdir -p "$LOG_DIR"

# Detect OS
OS_TYPE=$(uname -s)

# Function to log activity entry
log_entry() {
    local type=$1
    local data=$2
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    echo "{\"timestamp\":\"$timestamp\",\"type\":\"$type\",\"data\":$data}" >> "$LOG_FILE"
}

# Function to get active application (macOS)
get_active_app_macos() {
    osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' 2>/dev/null || echo "Unknown"
}

# Function to get active window title (macOS)
get_active_window_macos() {
    osascript -e 'tell application "System Events" to get name of front window of first application process whose frontmost is true' 2>/dev/null || echo "Unknown"
}

# Function to get active application (Linux)
get_active_app_linux() {
    if command -v xdotool &> /dev/null; then
        xdotool getactivewindow getwindowname 2>/dev/null || echo "Unknown"
    else
        echo "Unknown"
    fi
}

# Function to log application switch
log_app_switch() {
    local app=""
    local window=""
    
    case "$OS_TYPE" in
        Darwin)
            app=$(get_active_app_macos)
            window=$(get_active_window_macos)
            ;;
        Linux)
            app=$(get_active_app_linux)
            window="$app"
            ;;
        *)
            app="Unknown"
            window="Unknown"
            ;;
    esac
    
    local data="{\"application\":\"$app\",\"window\":\"$window\"}"
    log_entry "application_switch" "$data"
}

# Function to log file access
log_file_access() {
    local file=$1
    local action=$2
    local data="{\"file\":\"$file\",\"action\":\"$action\"}"
    log_entry "file_access" "$data"
}

# Function to log command execution
log_command() {
    local command=$1
    local data="{\"command\":\"$command\"}"
    log_entry "command_execution" "$data"
}

# Function to get recent commands
get_recent_commands() {
    if [ -f "$HOME/.bash_history" ]; then
        tail -n 10 "$HOME/.bash_history"
    elif [ -f "$HOME/.zsh_history" ]; then
        tail -n 10 "$HOME/.zsh_history" | cut -d';' -f2-
    fi
}

# Function to start monitoring
start_monitoring() {
    echo "Starting activity logging..."
    echo "Log file: $LOG_FILE"
    echo "Press Ctrl+C to stop"
    
    local last_app=""
    
    while true; do
        # Log application switch
        local current_app=""
        case "$OS_TYPE" in
            Darwin)
                current_app=$(get_active_app_macos)
                ;;
            Linux)
                current_app=$(get_active_app_linux)
                ;;
        esac
        
        if [ "$current_app" != "$last_app" ] && [ -n "$current_app" ]; then
            log_app_switch
            last_app="$current_app"
        fi
        
        sleep 5
    done
}

# Function to export log summary
export_summary() {
    if [ ! -f "$LOG_FILE" ]; then
        echo "No activity log found for today"
        exit 1
    fi
    
    echo "Activity Summary for $DATE"
    echo "=============================="
    echo ""
    
    # Count by type
    echo "Activity Types:"
    jq -r '.type' "$LOG_FILE" | sort | uniq -c | sort -rn
    echo ""
    
    # Top applications
    echo "Top Applications:"
    jq -r 'select(.type=="application_switch") | .data.application' "$LOG_FILE" | sort | uniq -c | sort -rn | head -10
    echo ""
    
    # Recent commands
    echo "Recent Commands:"
    jq -r 'select(.type=="command_execution") | .data.command' "$LOG_FILE" | tail -20
}

# Main
case "${1:-monitor}" in
    monitor)
        start_monitoring
        ;;
    log-app)
        log_app_switch
        ;;
    log-file)
        log_file_access "$2" "${3:-access}"
        ;;
    log-command)
        log_command "$2"
        ;;
    summary)
        export_summary
        ;;
    *)
        echo "Usage: $0 [monitor|log-app|log-file|log-command|summary]"
        echo "  monitor      - Start continuous monitoring (default)"
        echo "  log-app      - Log current application"
        echo "  log-file     - Log file access"
        echo "  log-command  - Log command execution"
        echo "  summary      - Export activity summary"
        exit 1
        ;;
esac
