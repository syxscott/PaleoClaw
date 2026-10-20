/**
 * Session isolation for the builtin task memory provider.
 *
 * Chat day digests are conversation transcripts. Before the fix the provider
 * searched with `scope: "all"`, which indexed *every* session's digests, so
 * one user's private text was recalled into another user's prompt (the
 * prompt is then sent to the model and may be echoed back).
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BuiltinTaskMemoryProvider } from "./manager.js";
import { TaskMemoryStore } from "./store.js";

let home: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "paleo-mem-scope-"));
  process.env.PALEOCLAW_HOME = home;
});

afterEach(() => {
  delete process.env.PALEOCLAW_HOME;
  fs.rmSync(home, { recursive: true, force: true });
});

function newStore(): TaskMemoryStore {
  return new TaskMemoryStore();
}

describe("chat memory is session-scoped", () => {
  it("does not inject one session's chat into another session's prompt", () => {
    const store = newStore();
    const sessionA = new BuiltinTaskMemoryProvider(store, { sessionId: "session-A" });
    const sessionB = new BuiltinTaskMemoryProvider(store, { sessionId: "session-B" });

    sessionA.sync("我司内部项目代号是 ZEPHYRUS-7，预算 320 万", "已记录该预算。");

    const leaked = sessionB.prefetch("ZEPHYRUS-7 项目预算是多少");
    expect(leaked).not.toContain("ZEPHYRUS-7");
    expect(leaked).not.toContain("320 万");

    // The owning session still recalls its own turn.
    const own = sessionA.prefetch("ZEPHYRUS-7");
    expect(own).toContain("ZEPHYRUS-7");
  });

  it("keeps three concurrent sessions isolated", () => {
    const store = newStore();
    const sessions = ["alpha", "beta", "gamma"].map(
      (id) => new BuiltinTaskMemoryProvider(store, { sessionId: id }),
    );
    const secrets = ["ALPHA-SECRET-9911", "BETA-SECRET-9922", "GAMMA-SECRET-9933"];

    sessions.forEach((provider, idx) => {
      provider.sync(`内部代号 ${secrets[idx]}`, "收到。");
    });

    sessions.forEach((provider, idx) => {
      for (const secret of secrets) {
        const block = provider.prefetch(`查询 ${secret}`);
        if (secret === secrets[idx]) {
          expect(block).toContain(secret);
        } else {
          expect(block).not.toContain(secret);
        }
      }
    });

    // Nothing leaked into the store-wide listing either.
    const files = fs.readdirSync(path.join(home, "memory", "short"));
    expect(files.filter((f) => f.startsWith("chat-"))).toHaveLength(3);
  });

  it("returns no chat entries when the caller names no session", () => {
    const store = newStore();
    const provider = new BuiltinTaskMemoryProvider(store, { sessionId: "session-A" });
    provider.sync("ZEPHYRUS-7 预算 320 万", "已记录。");

    // Fail closed: without a session there is no owner to scope the chat
    // corpus to, so no transcript may be returned.
    const hits = store.searchMemory({
      query: "ZEPHYRUS-7",
      scope: "all",
      topK: 5,
      minScore: 0.01,
    });
    expect(hits.filter((hit) => hit.source === "chat")).toHaveLength(0);
  });

  it("still recalls task memories across sessions", () => {
    const store = newStore();
    const taskId = store.startTask("dig", ["--site", "zhoukoudian"], os.tmpdir());
    store.finishTask(taskId, 0);

    const sessionB = new BuiltinTaskMemoryProvider(store, { sessionId: "session-B" });
    const block = sessionB.prefetch("dig zhoukoudian");

    // Task memories are work records without session identity — they stay
    // globally recallable.
    expect(block).toContain("[short]");
    expect(block).toContain(taskId);
  });
});
