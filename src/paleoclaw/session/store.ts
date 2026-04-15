/**
 * PaleoClaw Session Store
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SessionMessage, SessionRecord, SessionRole, SessionSearchHit } from './types.js';

function paleoclawHome(): string {
  return process.env.PALEOCLAW_HOME || path.join(os.homedir(), '.paleoclaw');
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}_${random}`;
}

function normalizeTitle(title?: string): string {
  const value = String(title || '').trim();
  return value || 'Untitled PaleoClaw Session';
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

function previewText(content: string, maxLen = 120): string {
  const value = content.replace(/\s+/g, ' ').trim();
  if (value.length <= maxLen) {
    return value;
  }
  return `${value.slice(0, maxLen - 3)}...`;
}

export class SessionStore {
  private root: string;
  private sessionsDir: string;

  constructor(root?: string) {
    this.root = root || path.join(paleoclawHome(), 'sessions');
    this.sessionsDir = this.root;
    this.ensurePaths();
  }

  private ensurePaths(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  private readSession(sessionId: string): SessionRecord {
    const file = this.getSessionPath(sessionId);
    if (!fs.existsSync(file)) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const data = fs.readFileSync(file, 'utf-8');
    return JSON.parse(data) as SessionRecord;
  }

  private writeSession(record: SessionRecord): void {
    const file = this.getSessionPath(record.id);
    fs.writeFileSync(file, JSON.stringify(record, null, 2), 'utf-8');
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

      if (title && title.trim() && existing.title !== title.trim()) {
        next.title = title.trim();
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
    const created: SessionRecord = {
      id: normalizedId,
      title: normalizeTitle(title),
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
    const record: SessionRecord = {
      id: makeId('session'),
      title: normalizeTitle(title),
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
    const message: SessionMessage = {
      id: makeId('msg'),
      role,
      content: String(content || ''),
      createdAt: nowIso(),
      metadata,
    };

    record.messages.push(message);
    record.updatedAt = nowIso();
    this.writeSession(record);

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
        sessions.push(JSON.parse(content) as SessionRecord);
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
    return {
      root: this.sessionsDir,
      count: this.listSessions(100_000).length,
    };
  }
}
