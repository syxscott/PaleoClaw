/**
 * PaleoClaw Memory Store - Short-term and long-term memory management
 * Adapted from GeoClaw-OpenAI v2.4.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { bestMatches, SearchItem } from './retrieval';
import { SessionProfile, loadSessionProfile, memoryContext } from '../profile/layers';

// Task memory interfaces
export interface TaskMemory {
  taskId: string;
  command: string;
  argv: string[];
  cwd: string;
  status: 'running' | 'success' | 'failed';
  returnCode: number | null;
  error: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string;
  promoted: boolean;
  review: ReviewData;
  profileSnapshot: Record<string, unknown>;
  extra?: Record<string, unknown>;
}

export interface ReviewData {
  reviewedAt?: string;
  summary?: string;
  lessons?: string[];
  nextActions?: string[];
}

export interface LongTermMemory {
  taskId: string;
  command: string;
  argv: string[];
  cwd: string;
  status: string;
  returnCode: number | null;
  createdAt: string;
  finishedAt: string;
  reviewedAt: string;
  summary: string;
  lessons: string[];
  nextActions: string[];
}

export interface ArchiveResult {
  moved: number;
  skipped: number;
  beforeDays: number;
  statusFilter: string;
  archiveDir: string;
  archivedTaskIds: string[];
}

function paleoclawHome(): string {
  return process.env.PALEOCLAW_HOME || path.join(os.homedir(), '.paleoclaw');
}

function utcNow(): string {
  return new Date().toISOString();
}

function generateTaskId(): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const random = Math.random().toString(36).substring(2, 10);
  return `${stamp}-${random}`;
}

export class TaskMemoryStore {
  private root: string;
  private shortDir: string;
  private archiveShortDir: string;
  private longFile: string;
  private sessionProfile: SessionProfile | null;

  constructor(sessionProfile?: SessionProfile) {
    this.root = path.join(paleoclawHome(), 'memory');
    this.shortDir = path.join(this.root, 'short');
    this.archiveShortDir = path.join(this.root, 'archive', 'short');
    this.longFile = path.join(this.root, 'long_term.jsonl');
    this.sessionProfile = sessionProfile || null;
    
    if (!this.sessionProfile) {
      try {
        this.sessionProfile = loadSessionProfile();
      } catch {
        this.sessionProfile = null;
      }
    }
    
    this.ensurePaths();
  }

  private ensurePaths(): void {
    if (!fs.existsSync(this.shortDir)) {
      fs.mkdirSync(this.shortDir, { recursive: true });
    }
    if (!fs.existsSync(this.archiveShortDir)) {
      fs.mkdirSync(this.archiveShortDir, { recursive: true });
    }
    if (!fs.existsSync(path.dirname(this.longFile))) {
      fs.mkdirSync(path.dirname(this.longFile), { recursive: true });
    }
    if (!fs.existsSync(this.longFile)) {
      fs.writeFileSync(this.longFile, '', 'utf-8');
    }
  }

  private shortPath(taskId: string): string {
    return path.join(this.shortDir, `${taskId}.json`);
  }

  private readShort(taskId: string): TaskMemory {
    const filePath = this.shortPath(taskId);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Short memory task not found: ${taskId}`);
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as TaskMemory;
  }

  private writeShort(taskId: string, payload: TaskMemory): void {
    const filePath = this.shortPath(taskId);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  private buildReview(task: TaskMemory): ReviewData {
    const command = task.command || 'task';
    const status = task.status;
    const returnCode = task.returnCode;
    const error = task.error || '';

    let summary: string;
    let lessons: string[];
    let nextActions: string[];

    if (status === 'success') {
      summary = `Command '${command}' completed successfully.`;
      lessons = ['Current parameters and environment are runnable and reproducible.'];
      nextActions = ['Keep output artifacts and logs for future comparison.'];
    } else {
      summary = `Command '${command}' failed with return code ${returnCode}.`;
      lessons = ['Failure information has been captured in short-term memory.'];
      nextActions = ['Check CLI output and rerun after fixing environment or parameters.'];
      if (error) {
        nextActions.push(`Primary error: ${error}`);
      }
    }

    // Add profile context
    const profileCtx = this.memoryProfileSnapshot();
    const repro = profileCtx.reproducibilityExpectations as string[] || [];
    const constraints = profileCtx.longTermConstraints as string[] || [];
    
    if (Array.isArray(repro)) {
      for (const item of repro.slice(0, 2)) {
        lessons.push(`Profile reproducibility expectation: ${item}`);
      }
    }
    
    if (status !== 'success' && Array.isArray(constraints)) {
      for (const item of constraints.slice(0, 2)) {
        nextActions.push(`Profile long-term constraint reminder: ${item}`);
      }
    }

    return {
      reviewedAt: utcNow(),
      summary,
      lessons,
      nextActions,
    };
  }

  private buildSearchText(payload: TaskMemory | LongTermMemory, source: string): string {
    const parts: string[] = [
      source,
      payload.taskId,
      payload.command,
      (payload.argv || []).join(' '),
      payload.status,
      (payload as TaskMemory).error || '',
      (payload as LongTermMemory).summary || '',
    ];

    const review = (payload as TaskMemory).review;
    if (review && typeof review === 'object') {
      parts.push(review.summary || '');
      parts.push(...(review.lessons || []));
      parts.push(...(review.nextActions || []));
    }

    parts.push(...((payload as LongTermMemory).lessons || []));
    parts.push(...((payload as LongTermMemory).nextActions || []));

    const snapshot = (payload as TaskMemory).profileSnapshot;
    if (snapshot && typeof snapshot === 'object') {
      parts.push(String(snapshot.userRole || ''));
      parts.push(String(snapshot.preferredTone || ''));
      parts.push(...(snapshot.reproducibilityExpectations as string[] || []));
      parts.push(...(snapshot.truthfulnessRules as string[] || []));
    }

    return parts.filter(x => x && x.trim()).join('\n');
  }

  private memoryProfileSnapshot(): Record<string, unknown> {
    if (!this.sessionProfile) {
      return {};
    }
    return memoryContext(this.sessionProfile);
  }

  // Public API
  startTask(command: string, argv: string[], cwd: string): string {
    const taskId = generateTaskId();
    const payload: TaskMemory = {
      taskId,
      command,
      argv: [...argv],
      cwd,
      status: 'running',
      returnCode: null,
      error: '',
      createdAt: utcNow(),
      updatedAt: utcNow(),
      finishedAt: '',
      promoted: false,
      review: {},
      profileSnapshot: this.memoryProfileSnapshot(),
    };
    this.writeShort(taskId, payload);
    return taskId;
  }

  finishTask(
    taskId: string,
    returnCode: number,
    error = '',
    extra?: Record<string, unknown>
  ): TaskMemory {
    const payload = this.readShort(taskId);
    payload.status = returnCode === 0 ? 'success' : 'failed';
    payload.returnCode = returnCode;
    payload.error = error.trim();
    payload.finishedAt = utcNow();
    payload.updatedAt = utcNow();
    
    if (extra) {
      payload.extra = { ...(payload.extra || {}), ...extra };
    }
    
    this.writeShort(taskId, payload);
    return payload;
  }

  autoReviewToLong(taskId: string): LongTermMemory {
    const task = this.readShort(taskId);
    const review = this.buildReview(task);
    
    const longPayload: LongTermMemory = {
      taskId: task.taskId,
      command: task.command,
      argv: task.argv,
      cwd: task.cwd,
      status: task.status,
      returnCode: task.returnCode,
      createdAt: task.createdAt,
      finishedAt: task.finishedAt,
      reviewedAt: review.reviewedAt || utcNow(),
      summary: review.summary || '',
      lessons: review.lessons || [],
      nextActions: review.nextActions || [],
    };

    // Append to long-term file
    fs.appendFileSync(this.longFile, JSON.stringify(longPayload) + '\n', 'utf-8');

    // Update short-term memory
    task.promoted = true;
    task.review = review;
    task.updatedAt = utcNow();
    this.writeShort(taskId, task);

    return longPayload;
  }

  reviewTaskToLong(
    taskId: string,
    summary = '',
    lessons?: string[],
    nextActions?: string[]
  ): LongTermMemory {
    const task = this.readShort(taskId);
    const auto = this.buildReview(task);

    const merged: ReviewData = {
      reviewedAt: utcNow(),
      summary: summary.trim() || auto.summary || '',
      lessons: lessons?.filter(x => x.trim()) || auto.lessons || [],
      nextActions: nextActions?.filter(x => x.trim()) || auto.nextActions || [],
    };

    const longPayload: LongTermMemory = {
      taskId: task.taskId,
      command: task.command,
      argv: task.argv,
      cwd: task.cwd,
      status: task.status,
      returnCode: task.returnCode,
      createdAt: task.createdAt,
      finishedAt: task.finishedAt,
      reviewedAt: merged.reviewedAt || utcNow(),
      summary: merged.summary || '',
      lessons: merged.lessons || [],
      nextActions: merged.nextActions || [],
    };

    fs.appendFileSync(this.longFile, JSON.stringify(longPayload) + '\n', 'utf-8');

    task.promoted = true;
    task.review = merged;
    task.updatedAt = utcNow();
    this.writeShort(taskId, task);

    return longPayload;
  }

  getShort(taskId: string): TaskMemory {
    return this.readShort(taskId);
  }

  listShort(options: { limit?: number; status?: string } = {}): TaskMemory[] {
    const { limit = 20, status = '' } = options;
    const rows: TaskMemory[] = [];
    
    const files = fs.readdirSync(this.shortDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.shortDir, file), 'utf-8');
        const payload = JSON.parse(content) as TaskMemory;
        
        if (status && payload.status !== status) {
          continue;
        }
        
        rows.push(payload);
        if (rows.length >= limit) break;
      } catch {
        // Skip invalid files
      }
    }

    return rows;
  }

  listLong(options: { limit?: number } = {}): LongTermMemory[] {
    const { limit = 20 } = options;
    const rows: LongTermMemory[] = [];
    
    if (!fs.existsSync(this.longFile)) {
      return rows;
    }

    const lines = fs.readFileSync(this.longFile, 'utf-8').split('\n').reverse();
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      try {
        const payload = JSON.parse(trimmed) as LongTermMemory;
        rows.push(payload);
        if (rows.length >= limit) break;
      } catch {
        // Skip invalid lines
      }
    }

    return rows;
  }

  listArchiveShort(options: { limit?: number; status?: string } = {}): TaskMemory[] {
    const { limit = 20, status = '' } = options;
    const rows: TaskMemory[] = [];
    
    if (!fs.existsSync(this.archiveShortDir)) {
      return rows;
    }

    const files = fs.readdirSync(this.archiveShortDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.archiveShortDir, file), 'utf-8');
        const payload = JSON.parse(content) as TaskMemory;
        
        if (status && payload.status !== status) {
          continue;
        }
        
        rows.push(payload);
        if (rows.length >= limit) break;
      } catch {
        // Skip invalid files
      }
    }

    return rows;
  }

  archiveShort(options: {
    beforeDays?: number;
    status?: string;
    includeRunning?: boolean;
  } = {}): ArchiveResult {
    const { beforeDays = 7, status = '', includeRunning = false } = options;
    const cutoff = new Date(Date.now() - beforeDays * 24 * 60 * 60 * 1000);
    
    let moved = 0;
    let skipped = 0;
    const archivedIds: string[] = [];

    const files = fs.readdirSync(this.shortDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(this.shortDir, file);
      
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const payload = JSON.parse(content) as TaskMemory;

        if (status && payload.status !== status) {
          skipped++;
          continue;
        }

        if (!includeRunning && payload.status === 'running') {
          skipped++;
          continue;
        }

        const ts = payload.finishedAt || payload.updatedAt || payload.createdAt;
        try {
          const itemTime = new Date(ts);
          if (itemTime > cutoff) {
            skipped++;
            continue;
          }
        } catch {
          skipped++;
          continue;
        }

        // Move to archive
        let dst = path.join(this.archiveShortDir, file);
        if (fs.existsSync(dst)) {
          const random = Math.random().toString(36).substring(2, 8);
          dst = path.join(this.archiveShortDir, `${path.parse(file).name}-${random}.json`);
        }
        
        fs.renameSync(filePath, dst);
        moved++;
        archivedIds.push(payload.taskId);
      } catch {
        skipped++;
      }
    }

    return {
      moved,
      skipped,
      beforeDays,
      statusFilter: status,
      archiveDir: this.archiveShortDir,
      archivedTaskIds: archivedIds,
    };
  }

  searchMemory(options: {
    query: string;
    scope?: string;
    topK?: number;
    minScore?: number;
  }): SearchItem[] {
    const { query, scope = 'long', topK = 5, minScore = 0.15 } = options;
    const scopeText = scope.toLowerCase() || 'long';
    
    if (!['short', 'long', 'archive', 'all'].includes(scopeText)) {
      throw new Error('scope must be one of: short, long, archive, all');
    }

    const items: SearchItem[] = [];

    if (scopeText === 'short' || scopeText === 'all') {
      for (const row of this.listShort({ limit: 500 })) {
        items.push({
          source: 'short',
          taskId: row.taskId,
          searchText: this.buildSearchText(row, 'short'),
          payload: row as Record<string, unknown>,
        });
      }
    }

    if (scopeText === 'archive' || scopeText === 'all') {
      for (const row of this.listArchiveShort({ limit: 1000 })) {
        items.push({
          source: 'archive',
          taskId: row.taskId,
          searchText: this.buildSearchText(row, 'archive'),
          payload: row as Record<string, unknown>,
        });
      }
    }

    if (scopeText === 'long' || scopeText === 'all') {
      for (const row of this.listLong({ limit: 1000 })) {
        items.push({
          source: 'long',
          taskId: row.taskId,
          searchText: this.buildSearchText(row as unknown as TaskMemory, 'long'),
          payload: row as unknown as Record<string, unknown>,
        });
      }
    }

    return bestMatches(query, items, topK, minScore);
  }

  countShort(): number {
    try {
      return fs.readdirSync(this.shortDir).filter(f => f.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  countLong(): number {
    try {
      if (!fs.existsSync(this.longFile)) return 0;
      const content = fs.readFileSync(this.longFile, 'utf-8');
      return content.split('\n').filter(line => line.trim()).length;
    } catch {
      return 0;
    }
  }

  getStatus(): {
    shortCount: number;
    longCount: number;
    memoryRoot: string;
    shortDir: string;
    longFile: string;
  } {
    return {
      shortCount: this.countShort(),
      longCount: this.countLong(),
      memoryRoot: this.root,
      shortDir: this.shortDir,
      longFile: this.longFile,
    };
  }
}
