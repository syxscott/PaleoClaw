#!/bin/bash
# Screen Monitor - Screenshot Capture Script
# Part of PaleoClaw Activity Monitoring System

set -e

# Configuration
INTERVAL=${SCREEN_MONITOR_INTERVAL:-60}  # seconds
OUTPUT_DIR=${SCREEN_MONITOR_DIR:-"$HOME/paleoclaw-logs/screenshots"}
DATE=$(date +%Y-%m-%d)
SESSION_DIR="$OUTPUT_DIR/$DATE"

# Create output directory
mkdir -p "$SESSION_DIR"

# Detect OS
OS_TYPE=$(uname -s)

# Function to capture screenshot
capture_screenshot() {
    local timestamp=$(date +%H-%M-%S)
    local filename="screen_${timestamp}.png"
    local filepath="$SESSION_DIR/$filename"
    
    case "$OS_TYPE" in
        Darwin)
            # macOS
            screencapture -x "$filepath"
            ;;
        Linux)
            # Linux (requires ImageMagick)
            import -window root "$filepath"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            # Windows (requires PowerShell)
            powershell -Command "Add-Type -AssemblyName System.Windows.Forms; \$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; \$bitmap = New-Object System.Drawing.Bitmap \$screen.Width, \$screen.Height; \$graphics = [System.Drawing.Graphics]::FromImage(\$bitmap); \$graphics.CopyFromScreen(\$screen.Location, [System.Drawing.Point]::Empty, \$screen.Size); \$bitmap.Save('$filepath', [System.Drawing.Imaging.ImageFormat]::Png)"
            ;;
        *)
            echo "Unsupported OS: $OS_TYPE"
            exit 1
            ;;
    esac
    
    if [ -f "$filepath" ]; then
        echo "Screenshot saved: $filepath"
        return 0
    else
        echo "Failed to capture screenshot"
        return 1
    fi
}

# Function to start monitoring
start_monitoring() {
    echo "Starting screen monitoring..."
    echo "Interval: ${INTERVAL}s"
    echo "Output: $SESSION_DIR"
    echo "Press Ctrl+C to stop"
    
    while true; do
        capture_screenshot
        sleep "$INTERVAL"
    done
}

# Function to capture single screenshot
capture_single() {
    echo "Capturing single screenshot..."
    capture_screenshot
}

# Main
case "${1:-monitor}" in
    monitor)
        start_monitoring
        ;;
    single)
        capture_single
        ;;
    *)
        echo "Usage: $0 [monitor|single]"
        echo "  monitor - Start continuous monitoring (default)"
        echo "  single  - Capture single screenshot"
        exit 1
        ;;
esac
