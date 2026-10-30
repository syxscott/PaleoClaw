/**
 * Regression test for the dead two-stage session title system.
 *
 * The agent command used to call
 *   `upsertSession(id, summarizePromptAsTitle(prompt), tags)`
 * and `summarizePromptAsTitle` never returns an empty string. Because both
 * stores record an explicitly supplied title as user-provenance ("user"),
 * `appendMessage` then computed
 *   `isFirstUserMessage && titleSource !== "user"`  ->  false
 * for every run, so Stage-1 derivation was unreachable (and Stage-2, which
 * needs a title that is not user-owned, with it). These tests pin the
 * corrected interaction: create without a title, then let the first user
 * message drive the title.
 *
 * The store-level assertions alone cannot see the agent's call site, so a
 * reverted `upsertSession(id, summarizePromptAsTitle(prompt), tags)` would
 * keep this file green while the regression was back. The last describe block
 * therefore also guards the agent source itself.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSessionStore } from "./index.js";
import { SessionStore, deriveInstantTitle, truncateTitle, upsertAgentSession } from "./store.js";

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
      upsertAgentSession(store, "sess-1", ["main"]);

      store.appendMessage("sess-1", "user", "What is the age range of Sinraptor? Also sources?");

      const record = store.getSession("sess-1");
      expect(record.title).toBe("What is the age range of Sinraptor?");
      expect(record.titleSource).toBe("derived");
      store.close?.();
    });

    it(`[${name}] the agent upsert helper leaves the title unset`, () => {
      const store = make();
      // A title derived from the prompt here would be stored as
      // user-provenance ("user") and block Stage-1 derivation forever.
      const record = upsertAgentSession(store, "sess-helper", ["main"]);
      expect(record.titleSource).toBe("derived");
      expect(record.title).toBe("Untitled PaleoClaw Session");
      expect(record.tags).toEqual(["main"]);
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
      upsertAgentSession(store, "sess-3", ["main"]);
      store.appendMessage("sess-3", "user", "Tell me about the Jehol Biota.");
      const first = store.getSession("sess-3").title;

      store.appendMessage("sess-3", "assistant", "An Early Cretaceous assemblage.");
      upsertAgentSession(store, "sess-3", ["main"]);
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
    const clippedCodePoints = Array.from(clipped);

    expect(clippedCodePoints).toHaveLength(23);
    expect(clippedCodePoints.slice(0, 20).every((c) => c === "\u{1F996}")).toBe(true);
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

/** Split a call's argument list on top-level commas. */
function splitCallArgs(args: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of args) {
    if (char === "(" || char === "[" || char === "{") {
      depth += 1;
    } else if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
    }
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current.trim());
  return parts;
}

describe("the agent call site keeps the title system reachable", () => {
  const agentSource = fs.readFileSync(path.resolve(__dirname, "../../commands/agent.ts"), "utf-8");

  it("still creates the session record for the agent turn", () => {
    expect(agentSource).toMatch(/upsertAgentSession\(|upsertSession\(/);
  });

  it("never hands a derived title to upsertSession", () => {
    const calls = [...agentSource.matchAll(/upsertSession\(((?:[^()]|\([^()]*\))*)\)/g)];
    for (const call of calls) {
      const args = splitCallArgs(call[1] ?? "");
      // The title argument must stay unset: an explicit title is recorded as
      // user-provenance ("user") and disables Stage-1/Stage-2 derivation.
      expect(args[1] ?? "undefined").toBe("undefined");
    }
  });
});
