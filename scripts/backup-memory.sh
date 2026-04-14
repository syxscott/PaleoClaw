#!/bin/bash
# PaleoClaw Memory Backup Script
# Backup memory system data to a timestamped archive

set -e

# Default values
BACKUP_DIR="${HOME}/.paleoclaw/backups"
MEMORY_DIR="${HOME}/.paleoclaw/agents"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="paleoclaw_memory_${TIMESTAMP}.tar.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  PaleoClaw Memory Backup Tool"
echo "========================================"
echo ""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        --memory-dir)
            MEMORY_DIR="$2"
            shift 2
            ;;
        --list)
            LIST_ONLY=true
            shift
            ;;
        --restore)
            RESTORE_FILE="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# List existing backups
list_backups() {
    echo -e "${YELLOW}Available backups:${NC}"
    echo ""
    if [ -d "$BACKUP_DIR" ]; then
        ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null | awk '{print $9, $5, $6, $7, $8}' || echo "No backups found"
    else
        echo "Backup directory does not exist"
    fi
    echo ""
}

# List only mode
if [ "$LIST_ONLY" = true ]; then
    list_backups
    exit 0
fi

# Restore mode
if [ -n "$RESTORE_FILE" ]; then
    echo -e "${YELLOW}Restoring from: $RESTORE_FILE${NC}"
    if [ ! -f "$RESTORE_FILE" ]; then
        echo -e "${RED}Error: Backup file not found: $RESTORE_FILE${NC}"
        exit 1
    fi
    
    # Create temporary restore directory
    RESTORE_TMP=$(mktemp -d)
    tar -xzf "$RESTORE_FILE" -C "$RESTORE_TMP"
    
    # Restore memory directory
    if [ -d "$RESTORE_TMP/memory" ]; then
        cp -r "$RESTORE_TMP/memory/"* "$MEMORY_DIR/" 2>/dev/null || true
        echo -e "${GREEN}Memory data restored successfully${NC}"
    fi
    
    # Restore sessions
    if [ -d "$RESTORE_TMP/sessions" ]; then
        cp -r "$RESTORE_TMP/sessions/"* "$MEMORY_DIR/" 2>/dev/null || true
        echo -e "${GREEN}Session data restored successfully${NC}"
    fi
    
    # Cleanup
    rm -rf "$RESTORE_TMP"
    exit 0
fi

# Backup mode
echo -e "${GREEN}Starting backup...${NC}"
echo ""
echo "Backup directory: $BACKUP_DIR"
echo "Memory directory: $MEMORY_DIR"
echo "Backup name: $BACKUP_NAME"
echo ""

# Check if memory directory exists
if [ ! -d "$MEMORY_DIR" ]; then
    echo -e "${RED}Error: Memory directory not found: $MEMORY_DIR${NC}"
    exit 1
fi

# Create backup
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Count files
FILE_COUNT=$(find "$MEMORY_DIR" -type f 2>/dev/null | wc -l)
echo "Found $FILE_COUNT files to backup"

# Create archive
tar -czf "$BACKUP_PATH" -C "$MEMORY_DIR" . 2>/dev/null

# Get file size
FILE_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)

echo ""
echo -e "${GREEN}✅ Backup completed successfully!${NC}"
echo ""
echo "Backup file: $BACKUP_PATH"
echo "Backup size: $FILE_SIZE"
echo ""

# Show backup info
echo "========================================"
echo "  Backup Information"
echo "========================================"
ls -lh "$BACKUP_PATH"
echo ""

# Keep only last 10 backups
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 10 ]; then
    echo -e "${YELLOW}Cleaning up old backups (keeping last 10)...${NC}"
    ls -1t "$BACKUP_DIR"/*.tar.gz | tail -n +11 | xargs rm -f 2>/dev/null || true
    echo "Cleanup completed"
fi

echo ""
echo -e "${GREEN}Done!${NC}"
