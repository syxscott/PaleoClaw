/**
 * PaleoClaw Session Module
 */

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
 * `<paleoclawHome()>/sessions/sessions.db` and silently falls back to the
 * JSON SessionStore when node:sqlite is unavailable or the database cannot
 * be opened. Never throws on sqlite unavailability.
 */
export function createSessionStore(options: CreateSessionStoreOptions = {}): SessionStoreLike {
  if (!options.forceJson) {
    try {
      return new SqliteSessionStore(defaultSessionDbPath(), {
        wal: options.wal,
        titleUpgrader: options.titleUpgrader,
      });
    } catch {
      // node:sqlite missing or DB init failed — fall back to the JSON store.
    }
  }
  return new SessionStore(undefined, { titleUpgrader: options.titleUpgrader });
}
