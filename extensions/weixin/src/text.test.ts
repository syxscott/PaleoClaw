import { describe, expect, it } from "vitest";
import {
  normalizeMarkdownBlocks,
  packBlocks,
  shouldSplitShortChatBlock,
  splitDeliveryUnits,
  splitMarkdownBlocks,
  splitTextForDelivery,
  walkMarkdownLines,
  wrapCopyFriendlyLines,
} from "./text.js";

describe("walkMarkdownLines / normalizeMarkdownBlocks", () => {
  it("tracks fenced code state across lines", () => {
    const walked = walkMarkdownLines("a\n```js\nb\n```\nc");
    expect(walked.map((w) => w.inCodeBlock)).toEqual([false, false, true, true, false]);
    expect(walked[1]?.isFence).toBe(true);
  });

  it("collapses blank runs outside fences only", () => {
    expect(normalizeMarkdownBlocks("a\n\n\n\nb")).toBe("a\n\nb");
    expect(normalizeMarkdownBlocks("```\n\n\n\n```")).toBe("```\n\n\n\n```");
  });
});

describe("splitMarkdownBlocks / splitDeliveryUnits", () => {
  it("keeps fenced code as one block", () => {
    const blocks = splitMarkdownBlocks("intro\n\n```py\nx=1\n\ny=2\n```\n\noutro");
    expect(blocks).toEqual(["intro", "```py\nx=1\n\ny=2\n```", "outro"]);
  });

  it("attaches indented continuation lines to the previous unit", () => {
    const units = splitDeliveryUnits("第一行\n  缩进续行\n第二行");
    expect(units).toEqual(["第一行\n  缩进续行", "第二行"]);
  });

  it("keeps a fenced block as a single unit", () => {
    const units = splitDeliveryUnits("```text\nline1\nline2\n```");
    expect(units).toHaveLength(1);
  });
});

describe("shouldSplitShortChatBlock", () => {
  it("splits chat-like multiline blocks", () => {
    expect(shouldSplitShortChatBlock("好的\n收到\n马上来")).toBe(true);
  });

  it("does not split headings or long lines", () => {
    expect(shouldSplitShortChatBlock("# 标题\n正文一")).toBe(false);
    expect(shouldSplitShortChatBlock("一句话特别长".repeat(20) + "\n短")).toBe(false);
    expect(shouldSplitShortChatBlock("只有一行")).toBe(false);
  });

  it("does not split label-style first lines ending with a colon", () => {
    expect(shouldSplitShortChatBlock("配置如下：\nA\nB")).toBe(false);
  });
});

describe("packBlocks", () => {
  it("packs small blocks together under the limit", () => {
    expect(packBlocks(["aaa", "bbb", "ccc"], 11)).toEqual(["aaa\nbbb\nccc"]);
  });

  it("flushes when adding a block would exceed the limit", () => {
    expect(packBlocks(["aaaa", "bbbb", "cccc"], 9)).toEqual(["aaaa\nbbbb", "cccc"]);
  });

  it("hard-wraps oversized blocks (deliberate deviation: keeps the tail)", () => {
    const long = "x".repeat(25);
    expect(packBlocks([long], 10)).toEqual(["x".repeat(10), "x".repeat(10), "x".repeat(5)]);
  });

  it("never splits a surrogate pair when hard-wrapping oversized blocks", () => {
    const long = `aaaaa${"😀".repeat(4)}`;
    const chunks = packBlocks([long], 6);
    for (const chunk of chunks) {
      // No lone high surrogate (not followed by a low surrogate) …
      expect(chunk).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
      // … and no lone low surrogate (not preceded by a high surrogate).
      expect(chunk).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    }
    expect(chunks.join("")).toBe(long);
  });
});

describe("wrapCopyFriendlyLines", () => {
  it("wraps long non-code lines at ~120 chars and keeps code/table lines intact", () => {
    const longLine = "word ".repeat(40).trim(); // 199 chars
    const wrapped = wrapCopyFriendlyLines(`\`\`\`\n${longLine}\n\`\`\`\n${longLine}`);
    const lines = wrapped.split("\n");
    // Fence keeps the long line intact; the outside line gets wrapped.
    expect(lines[1]?.length).toBe(199);
    expect(lines[3]?.length).toBeLessThanOrEqual(120);
  });

  it("leaves table lines unwrapped", () => {
    const tableLine = `| ${"c".repeat(150)} |`;
    expect(wrapCopyFriendlyLines(tableLine)).toBe(tableLine);
  });

  it("does not split a surrogate pair when wrapping long lines", () => {
    const line = `${"a".repeat(119)}😀${"b".repeat(10)}`;
    const wrapped = wrapCopyFriendlyLines(line);
    for (const part of wrapped.split("\n")) {
      expect(part).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
      expect(part).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    }
    expect(wrapped.replace(/\n/g, "")).toBe(line);
  });
});

describe("splitTextForDelivery (port of _split_text_for_weixin_delivery)", () => {
  it("returns short content as a single message", () => {
    expect(splitTextForDelivery("你好", 2000)).toEqual(["你好"]);
  });

  it("splits chatty short blocks into bubbles", () => {
    const chunks = splitTextForDelivery("在吗\n在的\n什么事", 2000);
    expect(chunks).toEqual(["在吗", "在的", "什么事"]);
  });

  it("packs long content into <= maxLength chunks", () => {
    const content = Array.from({ length: 50 }, (_, i) => `段落${i} ${"x".repeat(80)}`).join("\n\n");
    const chunks = splitTextForDelivery(content, 300);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(300);
    }
    // No content lost (modulo whitespace normalization at chunk edges).
    expect(chunks.join("")).toContain("段落49");
  });

  it("returns [] for empty content", () => {
    expect(splitTextForDelivery("", 100)).toEqual([]);
  });
});
