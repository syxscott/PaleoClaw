/**
 * PaleoClaw Session Module
 */

import { requireNodeSqlite } from "../../memory/sqlite.js";
import { SqliteSessionStore, defaultSessionDbPath } from "./store-sqlite.js";
import { SessionStore } from "./store.js";
import { SessionStoreLike, SessionTitleUpgrader } from "./types.js";

export * from "./types.js";
export * from "./store.js";
export * from "./store-sqlite.js";

export interface CreateSessionStoreOptions {
  /**
   * Force the JSON file-backed store even when node:sqlite is available.
   */
  forceJson?: boolean;
  /**
   * Disable WAL journal mode on the SQLite store (network filesystems).
   */
  wal?: boolean;
  /**
   * Stage-2 title upgrade hook, forwarded to the created store.
   */
  titleUpgrader?: SessionTitleUpgrader;
}

/**
 * Create the default session store. Prefers the SQLite-backed store at
 * `<paleoclawHome()>/sessions/sessions.db`.
 *
 * Only an *unsupported* runtime falls back to the JSON store. A SQLite failure
 * that means "the database exists but is corrupt or locked" is allowed to
 * propagate: the previous blanket catch silently downgraded to the JSON
 * backend in that case too, splitting session history across two files with no
 * diagnostic. Callers that must never throw can pass `forceJson`.
 */
export function createSessionStore(options: CreateSessionStoreOptions = {}): SessionStoreLike {
  if (options.forceJson) {
    return new SessionStore(undefined, { titleUpgrader: options.titleUpgrader });
  }

  // Probe capability separately from opening the database: only the former
  // justifies a silent downgrade.
  try {
    requireNodeSqlite();
  } catch {
    return new SessionStore(undefined, { titleUpgrader: options.titleUpgrader });
  }

  return new SqliteSessionStore(defaultSessionDbPath(), {
    wal: options.wal,
    titleUpgrader: options.titleUpgrader,
  });
}
