/**
 * Local literature summary helper tool
 */

import { toolRegistry } from "./registry.js";

interface SummaryParams {
  title?: string;
  abstract?: string;
  maxPoints?: number;
}

/**
 * Common scholarly abbreviations whose internal period is NOT a sentence
 * boundary. Without this, "et al." and "Fig. 3" get split mid-clause and the
 * following fragment becomes its own bullet point.
 *
 * The taxonomic abbreviations matter most here: this tool's input domain is
 * palaeontology abstracts, where genus abbreviations ("T. rex"), open
 * nomenclature ("sp.", "sp. nov.", "aff.", "gen.", "cf.") and ranks
 * ("subsp.", "var.") are near-universal. A stray "T." bullet is not only
 * meaningless — `splitSentences(...).slice(0, maxPoints)` lets it push a
 * real sentence out of the summary.
 *
 * Matching: the list is joined into `\b(?:...)\.$`, so entries are matched
 * case-sensitively and must end the current sentence fragment. Longer
 * entries must stay ahead of their prefixes ("et al" before "et").
 */
const ABBREVIATIONS = [
  "et al",
  "et",
  "al",
  "e.g",
  "i.e",
  "cf",
  "sens",
  "sp",
  "nov",
  "aff",
  "gen",
  "subsp",
  "var",
  "vs",
  "Fig",
  "Figs",
  "approx",
  "ca",
  "no",
  "Nos",
  "pp",
  "Dr",
  "Prof",
];

const ABBREVIATION_SUFFIX_RE = new RegExp(`\\b(?:${ABBREVIATIONS.join("|")})\\.$`);

/**
 * A single capital letter followed by a period is a genus abbreviation
 * ("T. rex", "G. iguanodon"), never a sentence end.
 */
const SINGLE_LETTER_ABBREVIATION_RE = /\b[A-Z]\.$/;

/**
 * Split on sentence terminators while protecting the three cases that a
 * naive split corrupts:
 *  - decimals and version numbers ("1.5 Ma", "Fig. 2") — a period between two
 *    digits, or between a digit and a letter, is never a sentence end;
 *  - known abbreviations ("et al.", "sp. nov.") — a period that ends a known
 *    abbreviation is not a sentence end;
 *  - genus abbreviations ("T. rex", "G. iguanodon") — a lone capital letter
 *    followed by a period is not a sentence end.
 */
function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const parts: string[] = [];
  let current = "";

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    current += char;

    if (
      char !== "." &&
      char !== "!" &&
      char !== "?" &&
      char !== "\u3002" &&
      char !== "\uff01" &&
      char !== "\uff1f"
    ) {
      continue;
    }

    const previous = normalized[index - 1] ?? "";
    const next = normalized[index + 1] ?? "";

    // "1.5" / "2.4" — digit on both sides is a decimal point.
    if (char === "." && /\d/.test(previous) && /\d/.test(next)) {
      continue;
    }

    // "et al." / "e.g." — the period terminates a known abbreviation.
    if (char === "." && ABBREVIATION_SUFFIX_RE.test(current.trimEnd())) {
      continue;
    }

    // "T. rex" / "G. iguanodon" — a lone capital letter followed by a period
    // is a genus abbreviation, not the end of a sentence.
    if (char === "." && SINGLE_LETTER_ABBREVIATION_RE.test(current.trimEnd())) {
      continue;
    }

    // Consume runs like "?!" / "..." so they do not create empty sentences.
    while (
      index + 1 < normalized.length &&
      ".!?\u3002\uff01\uff1f".includes(normalized[index + 1])
    ) {
      current += normalized[index + 1];
      index += 1;
    }

    // A terminator followed immediately by more word characters is mid-sentence
    // (e.g. a domain like "paleobiodb.org").
    if (next && /[A-Za-z0-9]/.test(next)) {
      continue;
    }

    parts.push(current.trim());
    current = "";
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts.filter(Boolean);
}

function summaryHandler(params: Record<string, unknown>): unknown {
  const typed = params as SummaryParams;
  const title = typed.title || "".trim();
  const abstract = typed.abstract || "".trim();
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
