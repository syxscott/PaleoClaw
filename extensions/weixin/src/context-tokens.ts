/**
 * Disk-backed `context_token` cache keyed by account + peer.
 *
 * Port of hermes-agent `weixin.py::ContextTokenStore`: every outbound reply
 * MUST echo the peer's latest `context_token` from getupdates, so the mapping
 * is persisted to disk (atomic tmp+rename write) and restored on startup.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export class ContextTokenStore {
  private readonly cache = new Map<string, string>();
  private readonly rootDir: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  private static key(accountId: string, userId: string): string {
    return `${accountId}:${userId}`;
  }

  private filePath(accountId: string): string {
    return join(this.rootDir, `${accountId}.context-tokens.json`);
  }

  /** Restore persisted tokens for one account from disk. */
  async restore(accountId: string): Promise<number> {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(await readFile(this.filePath(accountId), "utf8")) as Record<
        string,
        unknown
      >;
    } catch {
      return 0;
    }
    let restored = 0;
    for (const [userId, token] of Object.entries(data)) {
      if (typeof token === "string" && token) {
        this.cache.set(ContextTokenStore.key(accountId, userId), token);
        restored += 1;
      }
    }
    return restored;
  }

  get(accountId: string, userId: string): string | undefined {
    return this.cache.get(ContextTokenStore.key(accountId, userId));
  }

  /** Store a token and flush this account's slice to disk atomically. */
  async set(accountId: string, userId: string, token: string): Promise<void> {
    this.cache.set(ContextTokenStore.key(accountId, userId), token);
    const payload: Record<string, string> = {};
    const prefix = `${accountId}:`;
    for (const [key, value] of this.cache) {
      if (key.startsWith(prefix)) {
        payload[key.slice(prefix.length)] = value;
      }
    }
    // Serialize flushes so concurrent set() calls cannot land out of order.
    this.writeQueue = this.writeQueue.then(() => this.persist(accountId, payload));
    await this.writeQueue;
  }

  private async persist(accountId: string, payload: Record<string, string>): Promise<void> {
    try {
      await mkdir(dirname(this.filePath(accountId)), { recursive: true });
      const tmp = `${this.filePath(accountId)}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(payload, null, 2), "utf8");
      await rename(tmp, this.filePath(accountId));
    } catch {
      // Best-effort persistence; the in-memory cache stays authoritative.
    }
  }
}
