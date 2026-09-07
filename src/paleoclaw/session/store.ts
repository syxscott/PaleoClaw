/**
 * PaleoClaw Session Store
 *
 * JSON-file-per-session implementation. The SQLite-backed counterpart lives
 * in store-sqlite.ts; both implement the SessionStoreLike surface.
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { SessionMessage, SessionRecord, SessionRole, SessionSearchHit, SessionStoreLike, SessionTitleSource, SessionTitleUpgrader } from './types.js';
import { paleoclawHome, atomicWriteFile, ensurePrivateDir } from '../paths.js';

export const DEFAULT_SESSION_TITLE = 'Untitled PaleoClaw Session';

/** Max length (in code points) for derived/LLM-generated titles. */
const MAX_DERIVED_TITLE_LENGTH = 60;

function nowIso(): string {
  return new Date().toISOString();
}

// Use crypto.randomBytes for collision-resistant IDs instead of Math.random().
export function makeId(prefix: string): string {
  const stamp = Date.now().toString(36); // millisecond precision
  const randBytes = randomBytes(4).toString('hex').slice(0, 8);
  return `${prefix}_${stamp}_${randBytes}`;
}

function normalizeTitle(title?: string): string {
  const value = String(title || '').trim();
  return value || DEFAULT_SESSION_TITLE;
}

/**
 * Coerce a stored titleSource into a valid value. Old records missing the
 * field are classified by their title: a non-default title was explicitly
 * provided by the caller ('user'), the default placeholder is 'derived'.
 */
export function normalizeTitleSource(value?: string, title?: string): SessionTitleSource {
  if (value === 'user' || value === 'derived' || value === 'llm') {
    return value;
  }
  const normalized = String(title || '').trim();
  return normalized && normalized !== DEFAULT_SESSION_TITLE ? 'user' : 'derived';
}

/**
 * Truncate to ~60 chars without breaking surrogate pairs (titles may contain
 * Chinese text or emoji): slice at a code point boundary via Array.from.
 */
export function truncateTitle(value: string, maxLen: number = MAX_DERIVED_TITLE_LENGTH): string {
  const codePoints = Array.from(value);
  if (codePoints.length <= maxLen) {
    return value;
  }
  return `${codePoints.slice(0, maxLen).join('')}...`;
}

/**
 * Stage 1 title derivation (deterministic, synchronous, cannot fail): take
 * the first sentence of the first user message, collapse whitespace, and
 * truncate. Falls back to the generic default for empty input.
 */
export function deriveInstantTitle(rawMessage?: string): string {
  const collapsed = String(rawMessage || '').replace(/\s+/g, ' ').trim();
  if (!collapsed) {
    return DEFAULT_SESSION_TITLE;
  }

  // Split on the first sentence delimiter, keeping the delimiter itself.
  const match = collapsed.match(/[。！？.!?]/);
  let sentence = collapsed;
  if (match && match.index !== undefined && match.index > 0) {
    sentence = collapsed.slice(0, match.index + 1);
  }

  const candidate = sentence.trim();
  // If the leading "sentence" carries no letters or digits (e.g. the message
  // opens with punctuation), fall back to the whole collapsed message.
  if (/[\p{L}\p{N}]/u.test(candidate)) {
    return truncateTitle(candidate);
  }
  if (/[\p{L}\p{N}]/u.test(collapsed)) {
    return truncateTitle(collapsed);
  }
  return DEFAULT_SESSION_TITLE;
}

function scoreContent(queryTokens: string[], content: string): number {
  if (queryTokens.length === 0 || !content.trim()) {
    return 0;
  }
  const lowered = content.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (lowered.includes(token)) {
      score += 1;
    }
  }
  return score / queryTokens.length;
}

export function previewText(content: string, maxLen = 120): string {
  const value = content.replace(/\s+/g, ' ').trim();
  if (value.length <= maxLen) {
    return value;
  }
  return `${value.slice(0, maxLen - 3)}...`;
}

export interface SessionStoreOptions {
  /**
   * Stage-2 (async, optional) title upgrade hook. Fired once when the first
   * user message lands on a session whose title is not user-set. The store
   * never calls a model itself — the runtime injects the hook.
   */
  titleUpgrader?: SessionTitleUpgrader;
}

export class SessionStore implements SessionStoreLike {
  private root: string;
  private sessionsDir: string;
  private titleUpgrader?: SessionTitleUpgrader;

  constructor(root?: string, options: SessionStoreOptions = {}) {
    this.root = root || path.join(paleoclawHome(), 'sessions');
    this.sessionsDir = this.root;
    this.titleUpgrader = options.titleUpgrader;
    this.ensurePaths();
  }

  private ensurePaths(): void {
    // Session transcripts may contain private data — restrict to the owner.
    ensurePrivateDir(this.sessionsDir);
  }

  /**
   * Resolve a sessionId to a file path. Rejects any sessionId that contains
   * path separators or resolves outside the sessions directory to prevent
   * path traversal attacks from crafted CLI inputs.
   */
  private getSessionPath(sessionId: string): string {
    const id = String(sessionId || '').trim();
    // Reject path separators and traversal segments.
    if (!id || id.includes('/') || id.includes('\\') || id.includes('..')) {
      throw new Error(`Invalid sessionId: ${sessionId}`);
    }
    const resolved = path.join(this.sessionsDir, `${id}.json`);
    // Belt-and-suspenders: verify the resolved path stays under sessionsDir.
    if (!resolved.startsWith(this.sessionsDir + path.sep) && resolved !== this.sessionsDir) {
      throw new Error(`Invalid sessionId escapes sessions directory: ${sessionId}`);
    }
    return resolved;
  }

  private readSession(sessionId: string): SessionRecord {
    const file = this.getSessionPath(sessionId);
    if (!fs.existsSync(file)) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const data = fs.readFileSync(file, 'utf-8');
    return this.normalizeRecord(JSON.parse(data) as SessionRecord);
  }

  /** Backfill titleSource on records written before the field existed. */
  private normalizeRecord(record: SessionRecord): SessionRecord {
    if (record.titleSource) {
      return record;
    }
    return { ...record, titleSource: normalizeTitleSource(undefined, record.title) };
  }

  private writeSession(record: SessionRecord): void {
    const file = this.getSessionPath(record.id);
    atomicWriteFile(file, JSON.stringify(record, null, 2));
  }

  /**
   * Stage 2: upgrade a derived title via the injected hook (fire-and-forget,
   * best-effort). Re-reads the record before writing so a title the user set
   * while the upgrade was in flight always wins.
   */
  private maybeUpgradeTitle(sessionId: string, firstUserMessage: string, currentTitle: string): void {
    const upgrader = this.titleUpgrader;
    if (!upgrader) {
      return;
    }
    void upgrader({ sessionId, firstUserMessage, currentTitle })
      .then((upgraded) => {
        const upgradedTitle = String(upgraded || '').trim();
        if (!upgradedTitle) {
          return;
        }
        const fresh = this.readSession(sessionId);
        if ((fresh.titleSource ?? 'user') === 'user') {
          return;
        }
        fresh.title = truncateTitle(upgradedTitle);
        fresh.titleSource = 'llm';
        fresh.updatedAt = nowIso();
        this.writeSession(fresh);
      })
      .catch(() => {
        // Title upgrade is best-effort; never surface upgrader failures.
      });
  }

  upsertSession(sessionId: string, title?: string, tags: string[] = []): SessionRecord {
    const normalizedId = String(sessionId || '').trim();
    if (!normalizedId) {
      throw new Error('sessionId is required');
    }

    const file = this.getSessionPath(normalizedId);
    if (fs.existsSync(file)) {
      const existing = this.readSession(normalizedId);
      let changed = false;
      const next = { ...existing };

      // Only treat the call as a title update when the new title is non-empty
      // AND the existing title is not explicitly user-set. Avoids overwriting
      // a meaningful title with the latest user prompt on every turn, while
      // still letting an explicit title replace an auto-derived placeholder.
      if (
        title &&
        title.trim() &&
        (existing.titleSource ?? 'user') !== 'user' &&
        existing.title !== title.trim()
      ) {
        next.title = title.trim();
        next.titleSource = 'user';
        changed = true;
      }

      if (tags.length > 0) {
        const mergedTags = [...new Set([...existing.tags, ...tags])];
        if (mergedTags.length !== existing.tags.length) {
          next.tags = mergedTags;
          changed = true;
        }
      }

      if (changed) {
        next.updatedAt = nowIso();
        this.writeSession(next);
        return next;
      }

      return existing;
    }

    const current = nowIso();
    const trimmedTitle = String(title || '').trim();
    const created: SessionRecord = {
      id: normalizedId,
      title: trimmedTitle || DEFAULT_SESSION_TITLE,
      titleSource: trimmedTitle ? 'user' : 'derived',
      createdAt: current,
      updatedAt: current,
      tags: tags.filter((tag) => tag.trim().length > 0),
      messages: [],
    };
    this.writeSession(created);
    return created;
  }

  createSession(title?: string, tags: string[] = []): SessionRecord {
    const current = nowIso();
    const trimmedTitle = String(title || '').trim();
    const record: SessionRecord = {
      id: makeId('session'),
      title: trimmedTitle || DEFAULT_SESSION_TITLE,
      titleSource: trimmedTitle ? 'user' : 'derived',
      createdAt: current,
      updatedAt: current,
      tags: tags.filter((tag) => tag.trim().length > 0),
      messages: [],
    };

    this.writeSession(record);
    return record;
  }

  appendMessage(
    sessionId: string,
    role: SessionRole,
    content: string,
    metadata?: Record<string, unknown>
  ): SessionMessage {
    const record = this.readSession(sessionId);
    const isFirstUserMessage = role === 'user' && !record.messages.some((m) => m.role === 'user');
    const message: SessionMessage = {
      id: makeId('msg'),
      role,
      content: String(content || ''),
      createdAt: nowIso(),
      metadata,
    };

    record.messages.push(message);
    record.updatedAt = nowIso();

    // Stage 1: derive an instant title from the first user message so `list`
    // never shows the generic placeholder once any user message exists.
    if (isFirstUserMessage && (record.titleSource ?? 'user') !== 'user') {
      record.title = deriveInstantTitle(message.content);
      record.titleSource = 'derived';
    }

    this.writeSession(record);

    // Stage 2: kick off the optional async upgrade (never awaited).
    if (isFirstUserMessage && (record.titleSource ?? 'user') !== 'user') {
      this.maybeUpgradeTitle(sessionId, message.content, record.title);
    }

    return message;
  }

  getSession(sessionId: string): SessionRecord {
    return this.readSession(sessionId);
  }

  resumeSession(sessionId: string): SessionRecord {
    const record = this.readSession(sessionId);
    record.updatedAt = nowIso();
    this.writeSession(record);
    return record;
  }

  listSessions(limit = 20): SessionRecord[] {
    const files = fs.readdirSync(this.sessionsDir)
      .filter((name) => name.endsWith('.json'));

    const sessions: SessionRecord[] = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.sessionsDir, file), 'utf-8');
        const parsed = JSON.parse(content);
        // Skip files that don't conform to the SessionRecord shape (e.g.
        // stray config or backup JSON files in the sessions directory).
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.messages)) {
          continue;
        }
        sessions.push(this.normalizeRecord(parsed as SessionRecord));
      } catch {
        // skip invalid session files
      }
    }

    sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return sessions.slice(0, Math.max(1, limit));
  }

  search(query: string, limit = 10): SessionSearchHit[] {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    const tokens = normalized.split(/\s+/).filter(Boolean);
    const sessions = this.listSessions(500);
    const hits: SessionSearchHit[] = [];

    for (const session of sessions) {
      for (const message of session.messages) {
        const score = scoreContent(tokens, message.content);
        if (score <= 0) {
          continue;
        }

        hits.push({
          sessionId: session.id,
          title: session.title,
          messageId: message.id,
          score: Math.round(score * 10_000) / 10_000,
          preview: previewText(message.content),
          createdAt: message.createdAt,
        });
      }
    }

    hits.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));
    return hits.slice(0, Math.max(1, limit));
  }

  getStatus(): { root: string; count: number } {
    // Count .json files directly — no need to parse all session records just
    // to report a count.
    const count = fs.readdirSync(this.sessionsDir)
      .filter((name) => name.endsWith('.json'))
      .length;
    return {
      root: this.sessionsDir,
      count,
    };
  }

  /** No-op: the JSON store holds no persistent handles. */
  close(): void {
    // Nothing to release.
  }
}
