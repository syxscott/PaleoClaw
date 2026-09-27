/**
 * Outbound text splitting for WeChat bubbles — port of the pure markdown
 * helpers in hermes-agent `weixin.py` (`_split_text_for_weixin_delivery` and
 * friends).
 *
 * Compact mode (default): one message when it fits; multiline chat-like
 * blocks split into separate bubbles; fenced code stays intact; oversized
 * content is packed block-aware into <= max_length chunks.
 */

const HEADER_RE = /^(#{1,6})\s+(.+?)\s*$/;
const TABLE_RULE_RE = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/;
const FENCE_RE = /^```([^\n`]*)\s*$/;
const COPY_LINE_WIDTH = 120;

export type WalkedLine = {
  line: string;
  isFence: boolean;
  inCodeBlock: boolean;
};

/** Yield (rstripped line, is_fence, in_code_block) per line. */
export function walkMarkdownLines(content: string): WalkedLine[] {
  const out: WalkedLine[] = [];
  let inCodeBlock = false;
  for (const rawLine of content.split("\n")) {
    const line = rawLine.replace(/\r$/, "").trimEnd();
    const isFence = FENCE_RE.test(line.trim());
    out.push({ line, isFence, inCodeBlock });
    if (isFence) {
      inCodeBlock = !inCodeBlock;
    }
  }
  return out;
}

/** rstrip lines and collapse blank runs to one, leaving fenced code untouched. */
export function normalizeMarkdownBlocks(content: string): string {
  const result: string[] = [];
  let blankRun = 0;
  for (const { line, isFence, inCodeBlock } of walkMarkdownLines(content)) {
    if (!isFence && !inCodeBlock && !line.trim()) {
      blankRun += 1;
      if (blankRun <= 1) {
        result.push("");
      }
      continue;
    }
    if (isFence || !inCodeBlock) {
      blankRun = 0;
    }
    result.push(line);
  }
  return result.join("\n").trim();
}

/** Top-level lines become units; fenced code stays intact; indented continuation lines attach. */
export function splitMarkdownBlocks(content: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length > 0) {
      blocks.push(current.join("\n").trim());
      current = [];
    }
  };

  for (const { line, isFence, inCodeBlock } of walkMarkdownLines(content)) {
    if (isFence && !inCodeBlock) {
      flush(); // opening fence starts a fresh block
    }
    if (isFence || inCodeBlock || line.trim()) {
      current.push(line);
    } else {
      flush();
    }
    if (isFence && inCodeBlock) {
      flush(); // closing fence ends the block
    }
  }
  flush();
  return blocks.filter((block) => block.length > 0);
}

/** Top-level lines become units; indented lines attach to the previous line. */
export function splitDeliveryUnits(content: string): string[] {
  const units: string[] = [];
  for (const block of splitMarkdownBlocks(content)) {
    if (FENCE_RE.test(block.split("\n")[0]?.trim() ?? "")) {
      units.push(block);
      continue;
    }
    let current: string[] = [];
    for (const rawLine of block.split("\n")) {
      const line = rawLine.trimEnd();
      if (current.length > 0 && line.trim() && /^[ \t]/.test(rawLine)) {
        current.push(line);
        continue;
      }
      units.push(current.join("\n").trim());
      current = line.trim() ? [line] : [];
    }
    units.push(current.join("\n").trim());
  }
  return units.filter((unit) => unit.length > 0);
}

function looksLikeChattyLine(line: string): boolean {
  const stripped = line.trim();
  const blockedPrefixes = [">", "-", "*", "【", "#", "|"];
  return Boolean(
    stripped &&
    stripped.length <= 48 &&
    !/^[ \t]/.test(line) &&
    !blockedPrefixes.some((prefix) => stripped.startsWith(prefix)) &&
    !TABLE_RULE_RE.test(stripped) &&
    !/^\*\*[^*]+\*\*$/.test(stripped) &&
    !/^\d+\.\s/.test(stripped),
  );
}

/** Split only chat-like multiline blocks (2-6 chatty lines, first not a heading). */
export function shouldSplitShortChatBlock(block: string): boolean {
  const lines = block.split("\n").filter((line) => line.trim());
  if (lines.length < 2 || lines.length > 6) {
    return false;
  }
  const first = lines[0]?.trim() ?? "";
  if (
    HEADER_RE.test(first) ||
    (first.length <= 24 && (first.endsWith(":") || first.endsWith("：")))
  ) {
    return false;
  }
  return lines.every(looksLikeChattyLine);
}

/** Greedy word-wrap approximation of textwrap.wrap(break_long_words=False). */
function wrapLine(line: string, width: number): string[] {
  const words = line.split(/ /);
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    if (!word) {
      continue; // drop_whitespace
    }
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current = `${current} ${word}`;
    } else {
      out.push(current);
      current = word;
    }
    while (current.length > width) {
      // A single word longer than the width must still fit a chunk.
      out.push(current.slice(0, width));
      current = current.slice(width);
    }
  }
  if (current) {
    out.push(current);
  }
  return out.length > 0 ? out : [line.trimEnd()];
}

/** Wrap long display lines that are hard to copy in WeChat clients (port). */
export function wrapCopyFriendlyLines(content: string): string {
  if (!content) {
    return content;
  }
  const wrapped: string[] = [];
  for (const { line, isFence, inCodeBlock } of walkMarkdownLines(content)) {
    const stripped = line.trim();
    const keep =
      isFence ||
      inCodeBlock ||
      line.length <= COPY_LINE_WIDTH ||
      !stripped ||
      stripped.startsWith("|");
    if (keep || TABLE_RULE_RE.test(stripped)) {
      wrapped.push(line);
    } else {
      wrapped.push(...wrapLine(line, COPY_LINE_WIDTH));
    }
  }
  return wrapped.join("\n").trim();
}

/**
 * Block-aware packing into <= max_length chunks. Oversized single blocks are
 * hard-wrapped (the Python port truncated them; hard-wrap keeps the tail —
 * a deliberate, safer deviation for a chat bridge).
 */
export function packBlocks(blocks: string[], maxLength: number): string[] {
  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) {
      chunks.push(current.trim());
    }
    current = "";
  };
  for (const block of blocks) {
    if (block.length > maxLength) {
      flush();
      for (let i = 0; i < block.length; i += maxLength) {
        chunks.push(block.slice(i, i + maxLength));
      }
      continue;
    }
    if (!current) {
      current = block;
    } else if (current.length + 1 + block.length <= maxLength) {
      current = `${current}\n${block}`;
    } else {
      flush();
      current = block;
    }
  }
  flush();
  return chunks;
}

/**
 * Compact delivery split (port of `_split_text_for_weixin_delivery` with
 * split_per_line=False).
 */
export function splitTextForDelivery(content: string, maxLength: number): string[] {
  if (!content) {
    return [];
  }
  if (content.length <= maxLength) {
    return shouldSplitShortChatBlock(content) ? splitDeliveryUnits(content) : [content];
  }
  return packBlocks(splitMarkdownBlocks(content), maxLength);
}
