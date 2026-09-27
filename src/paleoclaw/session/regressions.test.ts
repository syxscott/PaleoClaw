/**
 * Regression test for the dead two-stage session title system.
 *
 * The agent command used to call
 *   `upsertSession(id, summarizePromptAsTitle(prompt), tags)`
 * and `summarizePromptAsTitle` never returns an empty string. Because both
 * stores record an explicitly supplied title as user-provenance ("user"),
 * `appendMessage` then computed
 *   `isFirstUserMessage && titleSource !== "user"`  ->  false
 * for every run, so Stage-1 derivation and the Stage-2 upgrader were both
 * unreachable. These tests pin the corrected interaction: create without a
 * title, then let the first user message drive the title.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSessionStore } from "./index.js";
import { SessionStore } from "./store.js";
import { deriveInstantTitle, truncateTitle } from "./store.js";

let home: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "paleo-sess-"));
  process.env.PALEOCLAW_HOME = home;
});

afterEach(() => {
  delete process.env.PALEOCLAW_HOME;
  fs.rmSync(home, { recursive: true, force: true });
});

/** Run the same body against every store backend. */
const backends: Array<[string, () => ReturnType<typeof createSessionStore>]> = [
  ["json", () => createSessionStore({ forceJson: true })],
  ["sqlite", () => createSessionStore()],
];

describe("session title derivation is reachable from the agent path", () => {
  for (const [name, make] of backends) {
    it(`[${name}] deriving happens when upsert passes no title`, () => {
      const store = make();
      // Mirrors the fixed agent.ts call site.
      store.upsertSession("sess-1", undefined, ["main"]);

      store.appendMessage("sess-1", "user", "What is the age range of Sinraptor? Also sources?");

      const record = store.getSession("sess-1");
      expect(record.title).toBe("What is the age range of Sinraptor?");
      expect(record.titleSource).toBe("derived");
      store.close?.();
    });

    it(`[${name}] an explicit title is user-provenance and is never overwritten`, () => {
      const store = make();
      store.upsertSession("sess-2", "My Chosen Title");

      store.appendMessage("sess-2", "user", "Some later prompt that would derive a title");

      const record = store.getSession("sess-2");
      expect(record.title).toBe("My Chosen Title");
      expect(record.titleSource).toBe("user");
      store.close?.();
    });

    it(`[${name}] the title is stable across later turns`, () => {
      const store = make();
      store.upsertSession("sess-3", undefined, ["main"]);
      store.appendMessage("sess-3", "user", "Tell me about the Jehol Biota.");
      const first = store.getSession("sess-3").title;

      store.appendMessage("sess-3", "assistant", "An Early Cretaceous assemblage.");
      store.upsertSession("sess-3", undefined, ["main"]);
      store.appendMessage("sess-3", "user", "A completely different second question?");

      expect(store.getSession("sess-3").title).toBe(first);
      store.close?.();
    });
  }
});

describe("title derivation details", () => {
  it("truncates by code point so surrogate pairs survive", () => {
    // 40 astral-plane chars = 80 UTF-16 units; a code-unit slice would cut a
    // surrogate pair in half and emit U+FFFD. truncateTitle appends "..."
    // after the kept code points, so expect maxLen content chars + 3.
    const emoji = "\u{1F996}".repeat(40);
    const clipped = truncateTitle(emoji, 20);

    expect([...clipped]).toHaveLength(23);
    expect([...clipped].slice(0, 20).every((c) => c === "\u{1F996}")).toBe(true);
    expect(clipped.endsWith("...")).toBe(true);
    // No lone surrogate and no replacement character anywhere in the result.
    expect(clipped).not.toContain("\uFFFD");
    expect(/(?:[\uD800-\uDBFF])(?![\uDC00-\uDFFF])/.test(clipped)).toBe(false);
  });

  it("leaves a title at or under the limit untouched", () => {
    const short = "Short title";
    expect(truncateTitle(short, 20)).toBe(short);
  });

  it("deriveInstantTitle takes the first sentence only", () => {
    expect(deriveInstantTitle("First bit. Second bit.")).toBe("First bit.");
  });

  it("deriveInstantTitle falls back for empty input", () => {
    expect(deriveInstantTitle("   ")).toBe("Untitled PaleoClaw Session");
  });
});

describe("session id safety is unchanged", () => {
  it("rejects traversal attempts in both backends", () => {
    for (const [name, make] of backends) {
      const store = make();
      expect(() => store.getSession("../escape")).toThrow(/Invalid sessionId/);
      expect(() => store.getSession("a/b")).toThrow(/Invalid sessionId/);
      store.close?.();
      expect(name).toBeTruthy();
    }
  });

  it("the JSON store resolves ids inside its sessions dir", () => {
    const root = path.join(home, "sessions");
    const store = new SessionStore(root);
    expect(() => store.getSession("..")).toThrow(/Invalid sessionId/);
  });
});
