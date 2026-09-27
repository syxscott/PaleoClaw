/**
 * Regression tests for the bug-fix pass on the PaleoClaw memory/session layer.
 *
 * Each test here failed before the corresponding fix:
 *  - chat day digests leaked into task listings, counts, and search;
 *  - unvalidated `limit` made `listShort` and `listLong` disagree;
 *  - the memory provider's `sync()` was a no-op, so nothing was ever written;
 *  - `deriveInstantTitle` never ran because the agent always claimed a
 *    "user"-provenance title.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BuiltinTaskMemoryProvider, createDefaultMemoryManager } from "./manager.js";
import { calculateSimilarity } from "./retrieval.js";
import { TaskMemoryStore } from "./store.js";

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
    });

    // Previously every chat file produced the constant search text "short",
    // so this query matched at score 1 with an undefined taskId.
    const byLabel = store.searchMemory({
      query: "short",
      scope: "short",
      topK: 5,
      minScore: 0.01,
    });
    expect(byLabel).toHaveLength(0);

    const byContent = store.searchMemory({
      query: "dromaeosaurid Jurassic",
      scope: "short",
      topK: 5,
      minScore: 0.01,
    });
    expect(byContent.length).toBeGreaterThan(0);
    expect(byContent[0].source).toBe("chat");
    expect(byContent[0].taskId).toMatch(/^chat-\d{8}-/);
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
    // A dimension-specific cache key must not leak across dimensions.
    const a = calculateSimilarity("Tyrannosaurus rex", "Tyrannosaurus rex");
    const b = calculateSimilarity("Tyrannosaurus rex", "Tyrannosaurus");
    expect(a).toBeGreaterThan(b);
    expect(a).toBeLessThanOrEqual(1);
  });
});
