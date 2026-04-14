#!/usr/bin/env bun
/**
 * PaleoClaw Research Sync Script
 * 
 * Synchronizes research data between different formats and destinations.
 * 
 * Usage:
 *   bun scripts/sync-research.ts --export [--format csv|json|excel]
 *   bun scripts/sync-research.ts --import <file>
 *   bun scripts/sync-research.ts --watch
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, cpSync } from 'fs';
import { join, basename, extname } from 'path';

interface ResearchItem {
  id: string;
  title: string;
  authors: string[];
  year: number;
  doi?: string;
  tags: string[];
  notes: string;
  created: string;
  updated: string;
}

const RESEARCH_DIR = join(process.env.HOME || '~', '.paleoclaw', 'research');
const BACKUP_DIR = join(process.env.HOME || '~', '.paleoclaw', 'research-backup');

function ensureDir(path: string) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function loadResearchData(): ResearchItem[] {
  ensureDir(RESEARCH_DIR);
  
  const items: ResearchItem[] = [];
  const files = readdirSync(RESEARCH_DIR).filter(f => extname(f) === '.json');
  
  for (const file of files) {
    try {
      const content = readFileSync(join(RESEARCH_DIR, file), 'utf-8');
      const data = JSON.parse(content);
      items.push(data);
    } catch (e) {
      console.error(`Error loading ${file}:`, e);
    }
  }
  
  return items;
}

function exportToCSV(items: ResearchItem[]): string {
  const headers = ['ID', 'Title', 'Authors', 'Year', 'DOI', 'Tags', 'Notes', 'Created', 'Updated'];
  const rows = items.map(item => [
    item.id,
    `"${item.title.replace(/"/g, '""')}"`,
    `"${item.authors.join(', ')}"`,
    item.year.toString(),
    item.doi || '',
    `"${item.tags.join(', ')}"`,
    `"${item.notes.replace(/"/g, '""')}"`,
    item.created,
    item.updated,
  ].join(','));
  
  return [headers.join(','), ...rows].join('\n');
}

function exportToJSON(items: ResearchItem[]): string {
  return JSON.stringify(items, null, 2);
}

function createBackup(): string {
  ensureDir(BACKUP_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUP_DIR, `research-${timestamp}`);
  
  mkdirSync(backupPath);
  if (existsSync(RESEARCH_DIR)) {
    cpSync(RESEARCH_DIR, backupPath, { recursive: true });
  }
  
  return backupPath;
}

async function main() {
  const args = process.argv.slice(2);
  
  console.log('========================================');
  console.log('  PaleoClaw Research Sync Tool');
  console.log('========================================');
  console.log('');
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage:
  bun scripts/sync-research.ts --export [--format csv|json]
  bun scripts/sync-research.ts --import <file>
  bun scripts/sync-research.ts --backup
  bun scripts/sync-research.ts --list

Options:
  --export     Export research data
  --format     Export format (csv, json) [default: json]
  --import     Import from file
  --backup     Create backup
  --list       List all research items
  --help       Show this help

Examples:
  bun scripts/sync-research.ts --export --format csv
  bun scripts/sync-research.ts --export --format json
  bun scripts/sync-research.ts --backup
  bun scripts/sync-research.ts --list
    `);
    return;
  }
  
  const items = loadResearchData();
  
  if (args.includes('--list')) {
    console.log(`Found ${items.length} research items:\n`);
    for (const item of items) {
      console.log(`[${item.id}] ${item.title}`);
      console.log(`  Authors: ${item.authors.join(', ')}`);
      console.log(`  Year: ${item.year}`);
      if (item.doi) console.log(`  DOI: ${item.doi}`);
      if (item.tags.length > 0) console.log(`  Tags: ${item.tags.join(', ')}`);
      console.log('');
    }
    return;
  }
  
  if (args.includes('--backup')) {
    const backupPath = createBackup();
    console.log(`✅ Backup created: ${backupPath}`);
    return;
  }
  
  if (args.includes('--export')) {
    const format = args.includes('--format') 
      ? args[args.indexOf('--format') + 1] || 'json'
      : 'json';
    
    const outputFile = `research-export.${format}`;
    
    let content: string;
    if (format === 'csv') {
      content = exportToCSV(items);
    } else {
      content = exportToJSON(items);
    }
    
    writeFileSync(outputFile, content, 'utf-8');
    console.log(`✅ Exported ${items.length} items to ${outputFile}`);
    return;
  }
  
  if (args.includes('--import')) {
    const importFile = args[args.indexOf('--import') + 1];
    if (!importFile) {
      console.error('Error: Import file required');
      process.exit(1);
    }
    
    if (!existsSync(importFile)) {
      console.error(`Error: File not found: ${importFile}`);
      process.exit(1);
    }
    
    // Create backup before import
    createBackup();
    console.log('✅ Backup created before import');
    
    const content = readFileSync(importFile, 'utf-8');
    let importedItems: ResearchItem[];
    
    if (extname(importFile) === '.csv') {
      // Simple CSV parsing for import
      const lines = content.split('\n').slice(1); // Skip header
      importedItems = lines
        .filter(line => line.trim())
        .map((line, index) => {
          const parts = line.split(',').map(p => p.replace(/^"|"$/g, '').replace(/""/g, '"'));
          return {
            id: `imported-${Date.now()}-${index}`,
            title: parts[1] || 'Untitled',
            authors: (parts[2] || '').split(', ').filter(a => a),
            year: parseInt(parts[3]) || new Date().getFullYear(),
            doi: parts[4] || undefined,
            tags: (parts[5] || '').split(', ').filter(t => t),
            notes: parts[6] || '',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          };
        });
    } else {
      importedItems = JSON.parse(content);
    }
    
    // Save imported items
    ensureDir(RESEARCH_DIR);
    for (const item of importedItems) {
      const filename = `${item.id}.json`;
      writeFileSync(join(RESEARCH_DIR, filename), JSON.stringify(item, null, 2), 'utf-8');
    }
    
    console.log(`✅ Imported ${importedItems.length} items`);
    return;
  }
  
  console.log('No action specified. Use --help for usage information.');
}

main();
