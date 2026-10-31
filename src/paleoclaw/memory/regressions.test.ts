import { spawn } from "node:child_process";
/**
 * Regression tests for the bug-fix pass on the PaleoClaw memory/session layer.
 *
 * Each test here failed before the corresponding fix:
 *  - chat day digests leaked into task listings, counts, and search;
 *  - unvalidated `limit` made `listShort` and `listLong` disagree;
 *  - the memory provider's `sync()` was a no-op, so nothing was ever written;
 *  - `deriveInstantTitle` never ran because the agent always claimed a
 *    "user"-provenance title;
 *  - chat digests of one session were recalled into another session's prompt;
 *  - `listChatDaily` capped the file count instead of a date window;
 *  - chat day files were never archived and had no cleanup entry point;
 *  - `recordChatTurn` lost a turn when two processes wrote the same file;
 *  - `countShort()` and `listShort()` disagreed on what counts as a task.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BuiltinTaskMemoryProvider, createDefaultMemoryManager } from "./manager.js";
import { calculateSimilarity, getCachedVector } from "./retrieval.js";
import { chatDayLockPath, TaskMemoryStore } from "./store.js";

let home: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "paleo-mem-"));
  process.env.PALEOCLAW_HOME = home;
});

afterEach(() => {
  delete process.env.PALEOCLAW_HOME;
  fs.rmSync(home, { recursive: true, force: true });
});

function newStore(): TaskMemoryStore {
  return new TaskMemoryStore();
}

function shortDir(): string {
  return path.join(home, "memory", "short");
}

function chatFiles(): string[] {
  return fs.readdirSync(shortDir()).filter((f) => f.startsWith("chat-"));
}

function sleepSync(ms: number): void {
  const shared = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(shared, 0, 0, ms);
}

/** A UTC day key (YYYYMMDD) plus a matching ISO timestamp, N days ago. */
function utcDay(offsetDays: number): { day: string; iso: string } {
  const stamp = new Date(Date.now() - offsetDays * 86_400_000);
  const y = stamp.getUTCFullYear();
  const m = String(stamp.getUTCMonth() + 1).padStart(2, "0");
  const d = String(stamp.getUTCDate()).padStart(2, "0");
  return { day: `${y}${m}${d}`, iso: `${y}-${m}-${d}T10:00:00Z` };
}

describe("chat day files are not task memories", () => {
  it("countShort ignores chat digests", () => {
    const store = newStore();
    const id = store.startTask("dig", ["--site", "zhoukoudian"], os.tmpdir());
    store.finishTask(id, 0);
    expect(store.getStatus().shortCount).toBe(1);

    store.recordChatTurn({
      sessionId: "sess-1",
      userText: "Tell me about Sinraptor",
      assistantText: "A dromaeosaurid from the Jurassic.",
    });

    // Still 1: the chat digest is a different record shape.
    expect(store.getStatus().shortCount).toBe(1);
  });

  it("listShort returns only real task rows with a populated shape", () => {
    const store = newStore();
    const id = store.startTask("dig", [], os.tmpdir());
    store.finishTask(id, 0);
    store.recordChatTurn({ sessionId: "s1", userText: "hi", assistantText: "hello" });

    const rows = store.listShort({ limit: 50 });
    expect(rows).toHaveLength(1);
    expect(rows[0].taskId).toBe(id);
    expect(rows[0].command).toBe("dig");
    expect(rows[0].status).toBe("success");
  });

  it("search indexes chat content instead of a constant label", () => {
    const store = newStore();
    store.recordChatTurn({
      sessionId: "sess-1",
      userText: "Tell me about Sinraptor",
      assistantText: "Sinraptor is a dromaeosaurid from the Jurassic of China.",
      // Pinned: the indexed text embeds the day token, so an unpinned date
      // made the "short" assertion below depend on the current date
      // (2027-10-26 collided with hash("short") and broke CI that day).
      ts: "2026-01-15T00:00:00Z",
    });

    // Previously every chat file produced the constant search text "short",
    // so this query matched at score 1 with an undefined taskId.
    const byLabel = store.searchMemory({
      query: "short",
      scope: "short",
      topK: 5,
      minScore: 0.01,
      sessionId: "sess-1",
    });
    expect(byLabel).toHaveLength(0);

    const byContent = store.searchMemory({
      query: "dromaeosaurid Jurassic",
      scope: "short",
      topK: 5,
      minScore: 0.01,
      sessionId: "sess-1",
    });
    expect(byContent.length).toBeGreaterThan(0);
    expect(byContent[0].source).toBe("chat");
    expect(byContent[0].taskId).toMatch(/^chat-\d{8}-/);
    // The fixture is date-stable: the day token never changes.
    expect(byContent[0].taskId).toBe("chat-20260115-sess-1");
  });

  it("keeps the pinned fixture stable when the current date changes", () => {
    // 2027-10-26 is the day whose day token collides with hash("short").
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-10-26T12:00:00Z"));
    try {
      const store = newStore();
      store.recordChatTurn({
        sessionId: "sess-1",
        userText: "Tell me about Sinraptor",
        assistantText: "Sinraptor is a dromaeosaurid from the Jurassic of China.",
        ts: "2026-01-15T00:00:00Z",
      });

      const byLabel = store.searchMemory({
        query: "short",
        scope: "short",
        topK: 5,
        minScore: 0.01,
        sessionId: "sess-1",
      });
      expect(byLabel).toHaveLength(0);

      const byContent = store.searchMemory({
        query: "dromaeosaurid Jurassic",
        scope: "short",
        topK: 5,
        minScore: 0.01,
        sessionId: "sess-1",
      });
      expect(byContent.length).toBeGreaterThan(0);
      expect(byContent[0].taskId).toBe("chat-20260115-sess-1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("chat digests survive archiving and never count as tasks", () => {
    const store = newStore();
    store.recordChatTurn({ sessionId: "s1", userText: "hi", assistantText: "hello" });

    // beforeDays 0 would otherwise sweep everything.
    store.archiveShort({ beforeDays: 0 });

    const remaining = fs.readdirSync(path.join(home, "memory", "short"));
    expect(remaining.some((f) => f.startsWith("chat-"))).toBe(true);
    expect(store.countShort()).toBe(0);
  });
});

describe("limit normalization", () => {
  it("listShort and listLong agree on a non-numeric limit", () => {
    const store = newStore();
    for (let i = 0; i < 3; i++) {
      const id = store.startTask(`cmd${i}`, [], os.tmpdir());
      store.finishTask(id, 0);
      store.reviewTaskToLong(id);
    }

    // slice(0, NaN) -> [] while `>= NaN` was never true -> everything.
    expect(store.listShort({ limit: Number.NaN })).toHaveLength(3);
    expect(store.listLong({ limit: Number.NaN })).toHaveLength(3);
  });

  it("clamps negative and zero limits to the default", () => {
    const store = newStore();
    for (let i = 0; i < 3; i++) {
      const id = store.startTask(`cmd${i}`, [], os.tmpdir());
      store.finishTask(id, 0);
    }

    // -1 used to silently drop the newest row via slice(0, -1).
    expect(store.listShort({ limit: -1 })).toHaveLength(3);
    expect(store.listShort({ limit: 0 })).toHaveLength(3);
    expect(store.listShort({ limit: 2 })).toHaveLength(2);
  });
});

describe("memory provider writes", () => {
  it("sync() records the turn so later prefetches can recall it", () => {
    const store = newStore();
    const provider = new BuiltinTaskMemoryProvider(store, { sessionId: "sess-9" });

    provider.sync("What is the age range of Sinraptor?", "About 160 Ma, Late Jurassic.");

    // A write must actually land on disk.
    const files = fs.readdirSync(path.join(home, "memory", "short"));
    expect(files.filter((f) => f.startsWith("chat-"))).toHaveLength(1);

    const digest = store.getChatDailyDigest(files[0].slice("chat-".length, "chat-".length + 8));
    expect(digest).not.toBeNull();
    expect(digest?.turn_count).toBe(1);
  });

  it("sync() is a no-op for an entirely empty turn", () => {
    const store = newStore();
    const provider = new BuiltinTaskMemoryProvider(store, { sessionId: "sess-9" });
    provider.sync("", "   ");
    expect(fs.readdirSync(path.join(home, "memory", "short"))).toHaveLength(0);
  });

  it("prefetch recalls a previously synced turn", () => {
    const store = newStore();
    const manager = createDefaultMemoryManager({ sessionId: "sess-7" });
    // Force the manager to use our isolated store.
    (manager as unknown as { providers: unknown[] }).providers.length = 0;
    const provider = new BuiltinTaskMemoryProvider(store, { sessionId: "sess-7" });
    manager.addProvider(provider);

    provider.sync(
      "Tell me about the Jehol Biota",
      "The Jehol Biota is an Early Cretaceous assemblage.",
    );
    const block = provider.prefetch("Jehol Biota");

    expect(block).toContain("chat");
    expect(block).toMatch(/Jehol Biota/i);
  });
});

describe("retrieval cache", () => {
  it("keys cached vectors by dimension as well as text", () => {
    // A dimension-specific cache key must not leak across dimensions. The
    // old assertion only called calculateSimilarity(), which hard-codes
    // dim=384 on both sides — it passed before and after the fix and guarded
    // nothing. This asserts the cache itself: the same text at two
    // dimensions must resolve to two distinct vectors.
    const narrow = getCachedVector("Tyrannosaurus rex", 384);
    const wide = getCachedVector("Tyrannosaurus rex", 768);

    // Different dimensions must not share a bucket...
    expect(narrow).not.toBe(wide);
    // ...while the same dimension still hits the cache.
    expect(getCachedVector("Tyrannosaurus rex", 384)).toBe(narrow);
    expect(getCachedVector("Tyrannosaurus rex", 768)).toBe(wide);

    // A dimension-specific vector is still a well-formed similarity vector.
    expect(calculateSimilarity("Tyrannosaurus rex", "Tyrannosaurus rex")).toBeCloseTo(1, 5);
    expect(calculateSimilarity("Tyrannosaurus rex", "Tyrannosaurus")).toBeLessThan(1);
  });
});

describe("chat day listing semantics", () => {
  it("applies a calendar-day window instead of a file-count limit", () => {
    const store = newStore();
    const older = utcDay(2);
    const newer = utcDay(1);

    // 6 sessions on each of 2 consecutive days -> 12 day files.
    for (const day of [older, newer]) {
      for (let i = 0; i < 6; i++) {
        store.recordChatTurn({
          sessionId: `s${i}`,
          userText: "u",
          assistantText: "a",
          ts: day.iso,
        });
      }
    }
    expect(chatFiles()).toHaveLength(12);

    // Invariant: listChatDaily(N) returns every digest whose UTC day falls in
    // the N-day window ending on the newest day present in the store — the
    // number of files does not truncate the window.
    expect(store.listChatDaily().length).toBe(12);
    expect(store.listChatDaily(1).length).toBe(6);
    expect(store.listChatDaily(2).length).toBe(12);
    expect(store.listChatDaily(30).length).toBe(12);
    expect(store.listChatDaily(1)[0].day).toBe(newer.day);

    // A window that does not reach the older day drops it.
    const onlyNewest = store.listChatDaily(1);
    expect(onlyNewest).toHaveLength(6);
    expect(onlyNewest.every((row) => row.day === newer.day)).toBe(true);
    expect(store.listChatDaily(2).some((row) => row.day === older.day)).toBe(true);
  });
});

describe("chat day retention", () => {
  it("sweeps stale chat digests when a new turn is written", () => {
    const store = newStore();
    store.recordChatTurn({
      sessionId: "sess-old",
      userText: "u",
      assistantText: "a",
      ts: "2020-01-01T00:00:00Z",
    });
    expect(chatFiles().some((f) => f.includes("sess-old"))).toBe(true);

    store.recordChatTurn({ sessionId: "sess-new", userText: "u", assistantText: "a" });

    const remaining = chatFiles();
    expect(remaining.some((f) => f.includes("sess-old"))).toBe(false);
    expect(remaining.some((f) => f.includes("sess-new"))).toBe(true);
  });

  it("purgeChatDaily removes only digests older than the cutoff", () => {
    const store = newStore();
    const stalePath = path.join(shortDir(), "chat-20200101-sess-old.json");
    fs.writeFileSync(
      stalePath,
      JSON.stringify({
        sessionId: "sess-old",
        day: "20200101",
        chat_digest: {
          turn_count: 1,
          first_turn_at: "2020-01-01T00:00:00Z",
          last_turn_at: "2020-01-01T00:00:00Z",
          intents: ["chat"],
          modes: ["fallback"],
          recent_turns: [],
        },
      }),
      "utf-8",
    );

    const result = store.purgeChatDaily({ beforeDays: 30 });
    expect(result.removed).toBe(1);
    expect(result.kept).toBe(0);
    expect(fs.existsSync(stalePath)).toBe(false);
  });
});

describe("chat day writes are serialized", () => {
  it("keeps the other writer's turn when two processes write the same day file", async () => {
    const store = newStore();
    const day = "20260115";
    const sessionId = "sess-race";
    const filePath = path.join(shortDir(), `chat-${day}-${sessionId}.json`);
    const lockPath = chatDayLockPath(filePath);
    const readyPath = path.join(home, "child-ready");

    // A second process that owns the day file: it takes the lock, publishes
    // its own turn and releases the lock again. Our writer has to wait for
    // the lock and merge that turn instead of overwriting it.
    const otherDigest = {
      sessionId,
      day,
      chat_digest: {
        turn_count: 1,
        first_turn_at: "2026-01-15T00:00:01Z",
        last_turn_at: "2026-01-15T00:00:01Z",
        intents: ["chat"],
        modes: ["fallback"],
        recent_turns: [
          { ts: "2026-01-15T00:00:01Z", user: "other-process", assistant: "other-reply" },
        ],
      },
    };

    const child = spawn(
      process.execPath,
      [
        "-e",
        [
          "const fs = require('fs');",
          "const [lockPath, filePath, readyPath, digest] = process.argv.slice(1);",
          "fs.writeFileSync(lockPath, String(process.pid), 'utf-8');",
          "fs.writeFileSync(readyPath, 'ready', 'utf-8');",
          "setTimeout(() => {",
          "  fs.writeFileSync(filePath, digest, 'utf-8');",
          "  fs.rmSync(lockPath, { force: true });",
          "  process.exit(0);",
          "}, 300);",
        ].join("\n"),
        lockPath,
        filePath,
        readyPath,
        JSON.stringify(otherDigest),
      ],
      { stdio: "ignore" },
    );

    try {
      const deadline = Date.now() + 15_000;
      while (!fs.existsSync(readyPath)) {
        if (Date.now() > deadline) {
          throw new Error("child process never took the chat day lock");
        }
        sleepSync(10);
      }

      store.recordChatTurn({
        sessionId,
        userText: "my-turn",
        assistantText: "my-reply",
        ts: "2026-01-15T00:00:00Z",
      });
    } finally {
      await new Promise<void>((resolve) => {
        if (child.exitCode !== null) {
          resolve();
          return;
        }
        child.on("exit", () => resolve());
      });
    }

    const digest = store.getChatDailyDigest(day);
    expect(digest?.turn_count).toBe(2);
    const users = (digest?.recent_turns ?? []).map((turn) => turn.user);
    expect(users).toContain("my-turn");
    expect(users).toContain("other-process");
  }, 20_000);
});

describe("count and list agree", () => {
  it("countShort ignores valid-json files that are not task memories", () => {
    const store = newStore();
    const id = store.startTask("dig", [], os.tmpdir());
    store.finishTask(id, 0);
    fs.writeFileSync(
      path.join(shortDir(), "notes.json"),
      JSON.stringify({ note: "not a task memory" }),
      "utf-8",
    );

    expect(store.listShort({ limit: 100 })).toHaveLength(1);
    expect(store.countShort()).toBe(1);
    expect(store.getStatus().shortCount).toBe(1);
  });
});
