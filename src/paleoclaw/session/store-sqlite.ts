/**
 * PaleoClaw SQLite Session Store (hermes_state_wal.py-inspired)
 *
 * SQLite-backed implementation of the SessionStoreLike surface with a
 * WAL-friendly pragma setup, an optional FTS5 index (LIKE fallback when the
 * sqlite build lacks FTS5), and corruption survival: search failures never
 * propagate — a broken FTS index is dropped, rebuilt from the messages table,
 * and the query is retried with LIKE.
 */

import * as path from 'path';
import type { DatabaseSync } from 'node:sqlite';
import { requireNodeSqlite } from '../../memory/sqlite.js';
import { paleoclawHome, ensurePrivateDir } from '../paths.js';
import {
  DEFAULT_SESSION_TITLE,
  deriveInstantTitle,
  makeId,
  normalizeTitleSource,
  previewText,
  truncateTitle,
} from './store.js';
import {
  SessionMessage,
  SessionRecord,
  SessionRole,
  SessionSearchHit,
  SessionStoreLike,
  SessionTitleSource,
  SessionTitleUpgrader,
} from './types.js';

function nowIso(): string {
  return new Date().toISOString();
}

/** Tokens containing CJK scripts: unicode61 does not segment them, use LIKE. */
const CJK_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

const LIKE_SEARCH_SQL = 'SELECT session_id, seq FROM messages WHERE content LIKE ? ESCAPE \'\\\'';

interface SessionRow {
  id: string;
  title: string;
  title_source: string | null;
  created_at: string;
  updated_at: string;
  meta: string | null;
}

interface MessageRow {
  role: string;
  content: string;
  ts: string;
  seq: number;
  metadata: string | null;
}

function asRows<T>(rows: Array<Record<string, unknown>>): T[] {
  return rows as unknown as T[];
}

function asRow(row: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  return row;
}

function parseJsonObject(raw?: string | null): Record<string, unknown> {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function escapeLikeToken(token: string): string {
  return token.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function escapeFtsToken(token: string): string {
  return `"${token.replace(/"/g, '""')}"`;
}

/**
 * Errors mentioning fts/corrupt/malformed indicate a broken FTS index (or a
 * dropped virtual table) — recoverable by rebuilding, unlike plain SQL bugs.
 */
function isFtsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /fts|corrupt|malformed/i.test(message);
}

/** sessionId -> seq -> number of query tokens matched (for scoring). */
type MatchCounts = Map<string, Map<number, number>>;

export interface SqliteSessionStoreOptions {
  /**
   * Disable WAL journal mode (e.g. on network filesystems where WAL locks
   * misbehave). If enabling WAL fails at open time the store silently falls
   * back to the default DELETE journal mode anyway.
   */
  wal?: boolean;
  /** Skip the FTS5 index entirely and always search via LIKE. */
  fts?: boolean;
  /** Same Stage-2 title hook as the JSON store. */
  titleUpgrader?: SessionTitleUpgrader;
}

export class SqliteSessionStore implements SessionStoreLike {
  private db: DatabaseSync;
  private dbPath: string;
  private walEnabled: boolean;
  private ftsAvailable: boolean = false;
  private titleUpgrader?: SessionTitleUpgrader;

  constructor(dbPath: string, options: SqliteSessionStoreOptions = {}) {
    this.dbPath = dbPath;
    this.titleUpgrader = options.titleUpgrader;

    const { DatabaseSync } = requireNodeSqlite();
    ensurePrivateDir(path.dirname(dbPath));
    this.db = new DatabaseSync(dbPath);

    this.walEnabled = options.wal !== false;
    this.applyPragmas();
    this.ensureSchema(options.fts !== false);
  }

  private applyPragmas(): void {
    if (this.walEnabled) {
      try {
        this.db.exec('PRAGMA journal_mode = WAL');
      } catch {
        // WAL can fail on network filesystems — fall back to DELETE silently.
        this.walEnabled = false;
        try {
          this.db.exec('PRAGMA journal_mode = DELETE');
        } catch {
          // Keep whatever default journal mode the build uses.
        }
      }
    }
    // Best-effort per pragma: never fail construction on a rejected pragma.
    for (const pragma of ['PRAGMA synchronous = NORMAL', 'PRAGMA foreign_keys = ON']) {
      try {
        this.db.exec(pragma);
      } catch {
        // Ignore.
      }
    }
  }

  private ensureSchema(ftsEnabled: boolean): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        title_source TEXT NOT NULL DEFAULT 'derived',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        meta TEXT NOT NULL DEFAULT '{}'
      );
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        ts TEXT NOT NULL,
        seq INTEGER NOT NULL,
        metadata TEXT,
        PRIMARY KEY (session_id, seq)
      );
    `);

    this.ftsAvailable = false;
    if (!ftsEnabled) {
      return;
    }
    try {
      this.createFtsTable();
      this.ftsAvailable = true;
      this.repairFtsIfDesynced();
    } catch {
      // sqlite build without FTS5 — LIKE-based search still works.
      this.ftsAvailable = false;
    }
  }

  /**
   * On reopen, an FTS table may exist but be empty while messages carry rows
   * (e.g. the index was dropped or lost). Rebuild it so search does not
   * silently return nothing.
   */
  private repairFtsIfDesynced(): void {
    try {
      const msgRow = asRow(
        this.db.prepare('SELECT COUNT(*) AS count FROM messages').get()
      ) as { count: number } | undefined;
      const ftsRow = asRow(
        this.db.prepare('SELECT COUNT(*) AS count FROM messages_fts').get()
      ) as { count: number } | undefined;
      if (Number(msgRow?.count ?? 0) > 0 && Number(ftsRow?.count ?? 0) === 0) {
        this.rebuildFts();
      }
    } catch {
      // Count probe failed — leave the state as-is; search-time recovery
      // still handles a broken index.
    }
  }

  private createFtsTable(): void {
    this.db.exec(
      'CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(content, session_id UNINDEXED, seq UNINDEXED)'
    );
  }

  /**
   * Drop and recreate the FTS index, repopulating it from the messages table.
   * On failure the store downgrades to LIKE search permanently.
   */
  private rebuildFts(): void {
    try {
      this.db.exec('DROP TABLE IF EXISTS messages_fts');
      this.createFtsTable();
      this.db.exec(
        'INSERT INTO messages_fts (content, session_id, seq) SELECT content, session_id, seq FROM messages'
      );
      this.ftsAvailable = true;
    } catch {
      this.ftsAvailable = false;
    }
  }

  private withTransaction<T>(fn: () => T): T {
    this.db.exec('BEGIN');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Transaction may already be rolled back.
      }
      throw error;
    }
  }

  private assertValidSessionId(sessionId: string): string {
    const id = String(sessionId || '').trim();
    // Same guard-rails as the JSON store so both backends reject identical ids.
    if (!id || id.includes('/') || id.includes('\\') || id.includes('..')) {
      throw new Error(`Invalid sessionId: ${sessionId}`);
    }
    return id;
  }

  private readMessages(sessionId: string): SessionMessage[] {
    const rows = asRows<MessageRow>(
      this.db
        .prepare('SELECT role, content, ts, seq, metadata FROM messages WHERE session_id = ? ORDER BY seq ASC')
        .all(sessionId)
    );
    return rows.map((row) => {
      const message: SessionMessage = {
        id: `${sessionId}:${row.seq}`,
        role: row.role as SessionRole,
        content: String(row.content ?? ''),
        createdAt: String(row.ts ?? ''),
      };
      const metadata = parseJsonObject(row.metadata);
      if (Object.keys(metadata).length > 0) {
        message.metadata = metadata;
      }
      return message;
    });
  }

  private rowToRecord(row: SessionRow): SessionRecord {
    const meta = parseJsonObject(row.meta);
    const title = String(row.title ?? DEFAULT_SESSION_TITLE);
    const rawTags = meta.tags;
    return {
      id: String(row.id),
      title,
      titleSource: normalizeTitleSource(row.title_source ?? undefined, title),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
      tags: Array.isArray(rawTags) ? rawTags.filter((tag): tag is string => typeof tag === 'string') : [],
      messages: this.readMessages(String(row.id)),
    };
  }

  private readRecord(sessionId: string): SessionRecord {
    const row = asRow(
      this.db
        .prepare('SELECT id, title, title_source, created_at, updated_at, meta FROM sessions WHERE id = ?')
        .get(sessionId)
    ) as SessionRow | undefined;
    if (!row) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return this.rowToRecord(row);
  }

  /**
   * Stage 2: upgrade a derived title via the injected hook (fire-and-forget,
   * best-effort). Re-reads the record first so a user-set title always wins.
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
        const fresh = this.readRecord(sessionId);
        if ((fresh.titleSource ?? 'user') === 'user') {
          return;
        }
        this.db
          .prepare('UPDATE sessions SET title = ?, title_source = ?, updated_at = ? WHERE id = ?')
          .run(truncateTitle(upgradedTitle), 'llm', nowIso(), sessionId);
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
    const id = this.assertValidSessionId(normalizedId);

    const trimmedTitle = String(title || '').trim();
    const filteredTags = tags.filter((tag) => tag.trim().length > 0);

    const exists = asRow(this.db.prepare('SELECT id FROM sessions WHERE id = ?').get(id)) as SessionRow | undefined;
    if (exists) {
      const existing = this.readRecord(id);
      let nextTitle = existing.title;
      let nextTitleSource: SessionTitleSource = existing.titleSource ?? 'user';
      let changed = false;

      // Only apply the new title when the existing one is not explicitly
      // user-set — keeps titles stable across agent turns.
      if (trimmedTitle && existing.titleSource !== 'user' && existing.title !== trimmedTitle) {
        nextTitle = trimmedTitle;
        nextTitleSource = 'user';
        changed = true;
      }

      const mergedTags =
        filteredTags.length > 0 ? [...new Set([...existing.tags, ...filteredTags])] : existing.tags;
      if (mergedTags.length !== existing.tags.length) {
        changed = true;
      }

      if (!changed) {
        return existing;
      }

      const updatedAt = nowIso();
      this.db
        .prepare('UPDATE sessions SET title = ?, title_source = ?, updated_at = ?, meta = ? WHERE id = ?')
        .run(nextTitle, nextTitleSource, updatedAt, JSON.stringify({ tags: mergedTags }), id);
      return { ...existing, title: nextTitle, titleSource: nextTitleSource, updatedAt, tags: mergedTags };
    }

    const current = nowIso();
    this.db
      .prepare('INSERT INTO sessions (id, title, title_source, created_at, updated_at, meta) VALUES (?, ?, ?, ?, ?, ?)')
      .run(
        id,
        trimmedTitle || DEFAULT_SESSION_TITLE,
        trimmedTitle ? 'user' : 'derived',
        current,
        current,
        JSON.stringify({ tags: filteredTags })
      );
    return this.readRecord(id);
  }

  createSession(title?: string, tags: string[] = []): SessionRecord {
    return this.upsertSession(makeId('session'), title, tags);
  }

  appendMessage(
    sessionId: string,
    role: SessionRole,
    content: string,
    metadata?: Record<string, unknown>
  ): SessionMessage {
    const id = this.assertValidSessionId(sessionId);
    const record = this.readRecord(id);
    const text = String(content || '');
    const isFirstUserMessage = role === 'user' && !record.messages.some((m) => m.role === 'user');
    // Stage 1: derive an instant title from the first user message so `list`
    // never shows the generic placeholder once any user message exists.
    const shouldDeriveTitle = isFirstUserMessage && (record.titleSource ?? 'user') !== 'user';
    const title = shouldDeriveTitle ? deriveInstantTitle(text) : record.title;

    const seqRow = asRow(
      this.db.prepare('SELECT MAX(seq) AS max_seq FROM messages WHERE session_id = ?').get(id)
    ) as { max_seq: number | null } | undefined;
    const seq = Number(seqRow?.max_seq ?? -1) + 1;
    const ts = nowIso();

    this.withTransaction(() => {
      if (shouldDeriveTitle) {
        this.db
          .prepare('UPDATE sessions SET title = ?, title_source = ? WHERE id = ?')
          .run(title, 'derived', id);
      }
      this.db
        .prepare('INSERT INTO messages (session_id, role, content, ts, seq, metadata) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, role, text, ts, seq, metadata ? JSON.stringify(metadata) : null);
      this.syncFts(id, seq, text);
      this.db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(nowIso(), id);
    });

    // Stage 2: kick off the optional async upgrade (never awaited).
    if (shouldDeriveTitle) {
      this.maybeUpgradeTitle(id, text, title);
    }

    const message: SessionMessage = {
      id: `${id}:${seq}`,
      role,
      content: text,
      createdAt: ts,
    };
    if (metadata) {
      message.metadata = metadata;
    }
    return message;
  }

  /** Best-effort FTS sync: a broken index is rebuilt from messages. */
  private syncFts(sessionId: string, seq: number, content: string): void {
    if (!this.ftsAvailable) {
      return;
    }
    try {
      this.db
        .prepare('INSERT INTO messages_fts (content, session_id, seq) VALUES (?, ?, ?)')
        .run(content, sessionId, seq);
    } catch (error) {
      if (isFtsError(error)) {
        // The rebuild re-indexes every row from messages (including this one),
        // so no retry insert is needed.
        this.rebuildFts();
        return;
      }
      throw error;
    }
  }

  getSession(sessionId: string): SessionRecord {
    return this.readRecord(this.assertValidSessionId(sessionId));
  }

  resumeSession(sessionId: string): SessionRecord {
    const id = this.assertValidSessionId(sessionId);
    const record = this.readRecord(id);
    const updatedAt = nowIso();
    this.db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(updatedAt, id);
    return { ...record, updatedAt };
  }

  listSessions(limit = 20): SessionRecord[] {
    const rows = asRows<SessionRow>(
      this.db
        .prepare('SELECT id, title, title_source, created_at, updated_at, meta FROM sessions ORDER BY updated_at DESC LIMIT ?')
        .all(Math.max(1, limit))
    );

    const sessions: SessionRecord[] = [];
    for (const row of rows) {
      try {
        sessions.push(this.rowToRecord(row));
      } catch {
        // skip unreadable rows
      }
    }
    return sessions;
  }

  search(query: string, limit = 10): SessionSearchHit[] {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) {
      return [];
    }
    const tokens = normalized.split(/\s+/).filter(Boolean).filter((token) => /[\p{L}\p{N}]/u.test(token));
    if (tokens.length === 0) {
      return [];
    }

    if (this.ftsAvailable) {
      try {
        return this.searchWithFts(tokens, limit);
      } catch (error) {
        if (isFtsError(error)) {
          // Corruption survival: drop + recreate the FTS table, rebuild from
          // messages, then retry this query once via LIKE below.
          this.rebuildFts();
        }
        // Fall through to LIKE — never propagate a search failure.
      }
    }

    try {
      return this.searchWithLike(tokens, limit);
    } catch {
      // Best-effort: return whatever we have (nothing) instead of throwing.
      return [];
    }
  }

  private searchWithFts(tokens: string[], limit: number): SessionSearchHit[] {
    const matches: MatchCounts = new Map();
    const ftsStmt = this.db.prepare('SELECT session_id, seq FROM messages_fts WHERE messages_fts MATCH ?');
    for (const token of tokens) {
      if (CJK_PATTERN.test(token)) {
        // unicode61 keeps CJK runs as single tokens — LIKE matches substring.
        this.collectLikeMatches(token, matches);
        continue;
      }
      const rows = asRows<{ session_id: string; seq: number }>(ftsStmt.all(escapeFtsToken(token)));
      for (const row of rows) {
        this.addMatch(matches, String(row.session_id), Number(row.seq));
      }
    }
    return this.buildHits(tokens, matches, limit);
  }

  private searchWithLike(tokens: string[], limit: number): SessionSearchHit[] {
    const matches: MatchCounts = new Map();
    for (const token of tokens) {
      this.collectLikeMatches(token, matches);
    }
    return this.buildHits(tokens, matches, limit);
  }

  private collectLikeMatches(token: string, matches: MatchCounts): void {
    const rows = asRows<{ session_id: string; seq: number }>(
      this.db.prepare(LIKE_SEARCH_SQL).all(`%${escapeLikeToken(token)}%`)
    );
    for (const row of rows) {
      this.addMatch(matches, String(row.session_id), Number(row.seq));
    }
  }

  private addMatch(matches: MatchCounts, sessionId: string, seq: number): void {
    const perSession = matches.get(sessionId) || new Map<number, number>();
    perSession.set(seq, (perSession.get(seq) || 0) + 1);
    matches.set(sessionId, perSession);
  }

  private buildHits(tokens: string[], matches: MatchCounts, limit: number): SessionSearchHit[] {
    const rowStmt = this.db.prepare(
      'SELECT m.content AS content, m.ts AS ts, s.title AS title FROM messages m JOIN sessions s ON s.id = m.session_id WHERE m.session_id = ? AND m.seq = ?'
    );

    const hits: SessionSearchHit[] = [];
    for (const [sessionId, perSession] of matches) {
      for (const [seq, count] of perSession) {
        const row = asRow(rowStmt.get(sessionId, seq)) as { content: string; ts: string; title: string } | undefined;
        if (!row) {
          continue;
        }
        const score = tokens.length > 0 ? count / tokens.length : 0;
        hits.push({
          sessionId,
          title: String(row.title ?? DEFAULT_SESSION_TITLE),
          messageId: `${sessionId}:${seq}`,
          score: Math.round(score * 10_000) / 10_000,
          preview: previewText(String(row.content ?? '')),
          createdAt: String(row.ts ?? ''),
        });
      }
    }

    hits.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));
    return hits.slice(0, Math.max(1, limit));
  }

  getStatus(): { root: string; count: number } {
    const row = asRow(this.db.prepare('SELECT COUNT(*) AS count FROM sessions').get()) as { count: number } | undefined;
    return {
      root: this.dbPath,
      count: Number(row?.count ?? 0),
    };
  }

  /** Checkpoint and release the database handle. */
  close(): void {
    try {
      this.db.close();
    } catch {
      // Already closed.
    }
  }
}

/**
 * Resolve the default SQLite session database path:
 * `<paleoclawHome()>/sessions/sessions.db`.
 */
export function defaultSessionDbPath(): string {
  return path.join(paleoclawHome(), 'sessions', 'sessions.db');
}
