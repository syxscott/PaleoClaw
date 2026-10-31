/**
 * Local literature summary helper tool
 */

import { toolRegistry } from "./registry.js";

interface SummaryParams {
  title?: string;
  abstract?: string;
  maxPoints?: number;
}

// Periods that do NOT end a sentence in paleontological prose: open
// nomenclature ("sp. nov.", "cf. Triceratops"), genus abbreviations ("T. rex"),
// figure/table references ("Fig. 3"), "et al.", and decimals ("1.5 m"). Each
// protected period is swapped for a sentinel before the split and restored
// afterwards, so the naive splitter no longer breaks on them.
const PROTECTED_PERIOD_PATTERNS = [
  /\b(cf|sp|nov|gen|subsp|var|spp|et al|Fig|fig|No|no|Vs|vs|etc|ca|Dr|Mr|Jr|St)\./gi,
  /\b([A-Z])\.(?=\s*[a-z])/g,
  /(\d)\.(?=\d)/g,
];

const PERIOD_SENTINEL = "\u0000";

function splitSentences(text: string): string[] {
  let masked = text;
  for (const pattern of PROTECTED_PERIOD_PATTERNS) {
    masked = masked.replace(pattern, (match) => match.replaceAll(".", PERIOD_SENTINEL));
  }
  // Match whole sentences (keeping the terminal punctuation) rather than
  // splitting-and-discarding, so bullets read as complete sentences.
  const sentences = masked.match(/[^。！？.!?]+[。！？.!?]*/g) ?? [];
  return sentences.map((item) => item.replaceAll(PERIOD_SENTINEL, ".").trim()).filter(Boolean);
}

function summaryHandler(params: Record<string, unknown>): unknown {
  const typed = params as SummaryParams;
  const title = (typed.title ?? "").trim();
  const abstract = (typed.abstract ?? "").trim();
  const parsedMax = Number(typed.maxPoints);
  const maxPoints = Math.max(1, Math.min(8, Number.isFinite(parsedMax) ? parsedMax : 4));

  if (!abstract) {
    throw new Error("abstract is required");
  }

  const sentences = splitSentences(abstract).slice(0, maxPoints);
  return {
    title,
    bulletPoints: sentences,
    recommendation:
      sentences.length > 0
        ? "建议继续抓取 DOI、年代地层信息并与 PBDB 记录交叉验证。"
        : "摘要内容不足，建议补充完整摘要后重试。",
  };
}

toolRegistry.register({
  name: "literature_summary",
  category: "analysis",
  description: "Generate a concise bullet summary from a paper abstract",
  schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Paper title" },
      abstract: { type: "string", description: "Paper abstract text" },
      maxPoints: { type: "number", description: "Max summary bullets (1-8)" },
    },
    required: ["abstract"],
  },
  handler: summaryHandler,
  timeoutMs: 2_000,
});
