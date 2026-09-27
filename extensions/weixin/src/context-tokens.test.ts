import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ContextTokenStore } from "./context-tokens.js";

describe("ContextTokenStore (per-peer context_token cache)", () => {
  it("stores and retrieves tokens keyed by account + peer", async () => {
    const dir = await mkdtemp(join(tmpdir(), "weixin-tokens-"));
    const store = new ContextTokenStore(dir);
    await store.set("acc1", "alice", "ctx-a1");
    await store.set("acc1", "bob", "ctx-b1");
    await store.set("acc2", "alice", "ctx-a2");

    expect(store.get("acc1", "alice")).toBe("ctx-a1");
    expect(store.get("acc1", "bob")).toBe("ctx-b1");
    expect(store.get("acc2", "alice")).toBe("ctx-a2");
    expect(store.get("acc1", "carol")).toBeUndefined();
  });

  it("persists to disk atomically and restores on a fresh store", async () => {
    const dir = await mkdtemp(join(tmpdir(), "weixin-tokens-"));
    const store = new ContextTokenStore(dir);
    await store.set("mybot", "alice", "ctx-1");
    await store.set("mybot", "bob", "ctx-2");

    // The account slice lands in <dir>/<account>.context-tokens.json
    const raw = JSON.parse(
      await readFile(join(dir, "mybot.context-tokens.json"), "utf8"),
    ) as Record<string, string>;
    expect(raw).toEqual({ alice: "ctx-1", bob: "ctx-2" });

    const restored = new ContextTokenStore(dir);
    expect(await restored.restore("mybot")).toBe(2);
    expect(restored.get("mybot", "alice")).toBe("ctx-1");
    expect(restored.get("mybot", "bob")).toBe("ctx-2");
  });

  it("restore() is a no-op for missing files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "weixin-tokens-"));
    const store = new ContextTokenStore(dir);
    expect(await store.restore("ghost")).toBe(0);
    expect(store.get("ghost", "alice")).toBeUndefined();
  });

  it("overwrites a peer token with the latest value", async () => {
    const dir = await mkdtemp(join(tmpdir(), "weixin-tokens-"));
    const store = new ContextTokenStore(dir);
    await store.set("acc", "alice", "old");
    await store.set("acc", "alice", "new");
    expect(store.get("acc", "alice")).toBe("new");
    await store.set("acc", "carol", "later"); // flush of the full slice keeps "new"
    const raw = JSON.parse(await readFile(join(dir, "acc.context-tokens.json"), "utf8")) as Record<
      string,
      string
    >;
    expect(raw.alice).toBe("new");
  });
});
