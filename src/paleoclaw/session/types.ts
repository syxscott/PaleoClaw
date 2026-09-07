/**
 * PaleoClaw Session types
 */

export type SessionRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Provenance of a session title:
 * - 'user': explicitly set by the caller/user — never overwritten.
 * - 'derived': deterministically derived from the first user message.
 * - 'llm': upgraded by an injected titleUpgrader (cheap model).
 */
export type SessionTitleSource = 'user' | 'derived' | 'llm';

export interface SessionMessage {
  id: string;
  role: SessionRole;
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface SessionRecord {
  id: string;
  title: string;
  /**
   * Where the title came from. Optional so records written before this field
   * existed still type-check; stores normalize it on load (a non-default
   * title without provenance is treated as 'user', the default as 'derived').
   */
  titleSource?: SessionTitleSource;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  messages: SessionMessage[];
}

export interface SessionSearchHit {
  sessionId: string;
  title: string;
  messageId: string;
  score: number;
  preview: string;
  createdAt: string;
}

/**
 * Injectable Stage-2 title hook. The store never calls an LLM itself; the
 * runtime may wire a cheap model here. Return null to keep the derived title.
 */
export type SessionTitleUpgrader = (input: {
  sessionId: string;
  firstUserMessage: string;
  currentTitle: string;
}) => Promise<string | null>;

/**
 * Shared public surface consumed by the CLI, tests, and the
 * `createSessionStore()` factory. Both the JSON store (SessionStore) and the
 * SQLite store (SqliteSessionStore) implement it structurally.
 */
export interface SessionStoreLike {
  createSession(title?: string, tags?: string[]): SessionRecord;
  upsertSession(sessionId: string, title?: string, tags?: string[]): SessionRecord;
  appendMessage(
    sessionId: string,
    role: SessionRole,
    content: string,
    metadata?: Record<string, unknown>
  ): SessionMessage;
  getSession(sessionId: string): SessionRecord;
  resumeSession(sessionId: string): SessionRecord;
  listSessions(limit?: number): SessionRecord[];
  search(query: string, limit?: number): SessionSearchHit[];
  getStatus(): { root: string; count: number };
  /** Release underlying resources (no-op for the JSON store). */
  close?(): void;
}
