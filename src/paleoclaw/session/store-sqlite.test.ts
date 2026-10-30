import * as fs from "fs";
import type { DatabaseSync } from "node:sqlite";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { requireNodeSqlite } from "../../memory/sqlite.js";
import { createSessionStore, SessionStore } from "./index.js";
import { SqliteSessionStore } from "./store-sqlite.js";
import type { SessionStoreLike } from "./types.js";

const tempDirs: string[] = [];
const stores: SessionStoreLike[] = [];

let sqliteAvailable = true;
try {
  requireNodeSqlite();
} catch {
  sqliteAvailable = false;
}

function createTempRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paleoclaw-session-sqlite-test-"));
  tempDirs.push(dir);
  return dir;
}

function createSqliteStore(
  options: ConstructorParameters<typeof SqliteSessionStore>[1] = {},
): SqliteSessionStore {
  const dir = createTempRoot();
  const store = new SqliteSessionStore(path.join(dir, "sessions.db"), options);
  stores.push(store);
  return store;
}

/** Access the raw handle for corruption/WAL simulations. */
function rawDb(store: SqliteSessionStore): DatabaseSync {
  return (store as unknown as { db: DatabaseSync }).db;
}

function listTables(store: SqliteSessionStore): string[] {
  const rows = rawDb(store)
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

/** Flush microtasks (e.g. the fire-and-forget titleUpgrader chain). */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function withPaleoclawHome<T>(home: string, fn: () => T): T {
  const previous = process.env.PALEOCLAW_HOME;
  process.env.PALEOCLAW_HOME = home;
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.PALEOCLAW_HOME;
    } else {
      process.env.PALEOCLAW_HOME = previous;
    }
  }
}

afterEach(() => {
  // Close before removing the temp dirs (required on Windows).
  for (const store of stores.splice(0)) {
    store.close?.();
  }
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("SqliteSessionStore", () => {
  it("round-trips create/append/get/list through sqlite", () => {
    const store = createSqliteStore();
    const session = store.createSession("Jurassic Notes", ["jurassic"]);
    expect(session.title).toBe("Jurassic Notes");
    expect(session.titleSource).toBe("user");

    store.appendMessage(session.id, "user", "Query PBDB for Allosaurus occurrences");
    store.appendMessage(session.id, "assistant", "Found 12 records", { count: 12 });

    const loaded = store.getSession(session.id);
    expect(loaded.title).toBe("Jurassic Notes");
    expect(loaded.titleSource).toBe("user");
    expect(loaded.tags).toEqual(["jurassic"]);
    expect(loaded.messages).toHaveLength(2);
    expect(loaded.messages[0]?.role).toBe("user");
    expect(loaded.messages[0]?.metadata).toBeUndefined();
    expect(loaded.messages[1]?.metadata).toEqual({ count: 12 });

    const listed = store.listSessions(10);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(session.id);

    expect(store.getStatus()).toEqual({ root: expect.any(String), count: 1 });
    expect(() => store.getSession("does-not-exist")).toThrow("Session not found");
  });

  it("derives an instant title from the first user message (Stage 1)", () => {
    const store = createSqliteStore();
    const session = store.createSession();
    expect(session.titleSource).toBe("derived");

    store.appendMessage(session.id, "user", "帮我查询三角龙的化石记录。顺便列出地层");
    store.appendMessage(session.id, "user", "Second user message is ignored for titles");

    const loaded = store.getSession(session.id);
    expect(loaded.title).toBe("帮我查询三角龙的化石记录。");
    expect(loaded.titleSource).toBe("derived");
    expect(loaded.messages).toHaveLength(2);
  });

  it("never overrides a user-set title with a derived one", () => {
    const store = createSqliteStore();
    const session = store.createSession("Manual Title");
    store.appendMessage(session.id, "user", "帮我查询三角龙的化石记录。");

    const loaded = store.getSession(session.id);
    expect(loaded.title).toBe("Manual Title");
    expect(loaded.titleSource).toBe("user");
  });

  it("upgrades derived titles via the injected hook (Stage 2)", async () => {
    const store = createSqliteStore({ titleUpgrader: async () => "LLM Polished Title" });
    const session = store.createSession();
    store.appendMessage(session.id, "user", "plain first message without delimiters");

    const immediate = store.getSession(session.id);
    expect(immediate.title).toBe("plain first message without delimiters");
    expect(immediate.titleSource).toBe("derived");

    await flush();

    const upgraded = store.getSession(session.id);
    expect(upgraded.title).toBe("LLM Polished Title");
    expect(upgraded.titleSource).toBe("llm");
  });

  it("matches JSON-store upsert semantics (title preserved, tags merged)", () => {
    const store = createSqliteStore();
    const first = store.upsertSession("external-session-id", "Seed title", ["seed"]);
    expect(first.title).toBe("Seed title");
    expect(first.titleSource).toBe("user");

    const second = store.upsertSession("external-session-id", "Updated title", ["new-tag"]);
    expect(second.title).toBe("Seed title");
    expect(second.tags).toEqual(expect.arrayContaining(["seed", "new-tag"]));
  });

  it("touches updatedAt on resume", async () => {
    const store = createSqliteStore();
    const session = store.createSession("Resume Me");
    await new Promise((resolve) => setTimeout(resolve, 5));

    const resumed = store.resumeSession(session.id);
    expect(resumed.updatedAt >= session.updatedAt).toBe(true);
  });

  it("searches via FTS5 with scores and previews", () => {
    const store = createSqliteStore();
    const session = store.createSession("Cretaceous Workflow");
    store.appendMessage(session.id, "user", "Need Cretaceous fossil references with DOI");

    const hits = store.search("cretaceous doi", 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.sessionId).toBe(session.id);
    expect(hits[0]?.messageId).toBe(`${session.id}:0`);
    expect(hits[0]?.preview).toContain("Cretaceous");

    // Punctuation-only queries match nothing instead of throwing.
    expect(store.search("!!! ???", 5)).toEqual([]);
    expect(store.search("", 5)).toEqual([]);
  });

  it("matches CJK queries via the LIKE route", () => {
    const store = createSqliteStore();
    const session = store.createSession();
    store.appendMessage(session.id, "user", "帮我查询三角龙的化石记录。");

    const hits = store.search("三角龙", 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.sessionId).toBe(session.id);
  });

  it("falls back to LIKE search when FTS5 is unavailable", () => {
    const store = createSqliteStore({ fts: false });
    expect(listTables(store)).not.toContain("messages_fts");

    const session = store.createSession("Fallback Works");
    store.appendMessage(session.id, "user", "Hadrosaur marrow fossils discovered");

    const hits = store.search("hadrosaur", 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.sessionId).toBe(session.id);
  });

  it("recovers from a dropped (corrupted) FTS table", () => {
    const store = createSqliteStore();
    const session = store.createSession("Recovery Probe");
    store.appendMessage(session.id, "user", "Ammonite suture patterns from the literature");

    // Simulate corruption by dropping the FTS table out from under the store.
    rawDb(store).exec("DROP TABLE messages_fts");

    // Search must not throw and must still return best-effort results.
    const hits = store.search("ammonite", 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.sessionId).toBe(session.id);

    // The FTS table was rebuilt from messages and serves later searches.
    expect(listTables(store)).toContain("messages_fts");
    const again = store.search("ammonite", 5);
    expect(again.length).toBeGreaterThan(0);
    expect(again[0]?.sessionId).toBe(session.id);

    // Appends keep syncing into the rebuilt index.
    store.appendMessage(session.id, "user", "Belemnite guard morphology notes");
    const belemnite = store.search("belemnite", 5);
    expect(belemnite.length).toBeGreaterThan(0);
  });

  it("runs WAL pragmas by default and supports disabling WAL", () => {
    const walStore = createSqliteStore();
    const walMode = rawDb(walStore).prepare("PRAGMA journal_mode").get() as {
      journal_mode: string;
    };
    expect(String(walMode.journal_mode).toLowerCase()).toBe("wal");

    const deleteStore = createSqliteStore({ wal: false });
    const deleteMode = rawDb(deleteStore).prepare("PRAGMA journal_mode").get() as {
      journal_mode: string;
    };
    expect(String(deleteMode.journal_mode).toLowerCase()).toBe("delete");
  });

  it("rejects invalid session ids like the JSON store", () => {
    const store = createSqliteStore();
    expect(() => store.upsertSession("")).toThrow("sessionId is required");
    expect(() => store.upsertSession("../escape")).toThrow("Invalid sessionId");
    expect(() => store.getSession("a/b")).toThrow("Invalid sessionId");
  });
});

describe("createSessionStore", () => {
  it("returns the JSON store in forceJson mode", () => {
    const dir = createTempRoot();
    withPaleoclawHome(dir, () => {
      const store = createSessionStore({ forceJson: true });
      stores.push(store);
      expect(store).toBeInstanceOf(SessionStore);

      const created = store.createSession("Factory JSON");
      expect(fs.existsSync(path.join(dir, "sessions", `${created.id}.json`))).toBe(true);
    });
  });

  it("prefers sqlite when node:sqlite is available, never throwing", () => {
    const dir = createTempRoot();
    withPaleoclawHome(dir, () => {
      const store = createSessionStore();
      stores.push(store);

      if (sqliteAvailable) {
        expect(store).toBeInstanceOf(SqliteSessionStore);
        expect(fs.existsSync(path.join(dir, "sessions", "sessions.db"))).toBe(true);
      } else {
        expect(store).toBeInstanceOf(SessionStore);
      }

      const created = store.createSession("Factory Probe");
      expect(store.getSession(created.id).title).toBe("Factory Probe");
    });
  });
});
