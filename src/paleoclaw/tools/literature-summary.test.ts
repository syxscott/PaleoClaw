/**
 * Tests for the local literature summary helper.
 *
 * The tool summarises palaeontology abstracts, where genus abbreviations
 * ("T. rex"), open nomenclature ("sp. nov.", "aff.", "gen.") and ranks
 * ("subsp.", "var.") are near-universal. A stray "T." bullet is not only
 * meaningless: `splitSentences(...).slice(0, maxPoints)` lets it push a real
 * sentence out of the summary.
 */
import { describe, expect, it } from "vitest";
import { toolRegistry } from "./registry.js";
import "./literature-summary.js";

interface SummaryResult {
  title: string;
  bulletPoints: string[];
  recommendation: string;
}

async function summarize(params: Record<string, unknown>): Promise<SummaryResult> {
  const result = await toolRegistry.execute("literature_summary", params);
  expect(result.ok).toBe(true);
  return result.data as SummaryResult;
}

describe("literature_summary sentence splitting", () => {
  it("does not split a genus abbreviation into its own bullet", async () => {
    const summary = await summarize({
      title: "T. rex",
      abstract: "T. rex is represented. It lived in the Late Cretaceous.",
    });

    expect(summary.bulletPoints).toEqual([
      "T. rex is represented.",
      "It lived in the Late Cretaceous.",
    ]);
    expect(summary.bulletPoints).not.toContain("T.");
  });

  it("keeps the real sentences when maxPoints truncates the list", async () => {
    const abstract = [
      "T. rex is represented.",
      "It lived in the Late Cretaceous.",
      "The specimen was collected from the Hell Creek Formation.",
    ].join(" ");

    const summary = await summarize({ abstract, maxPoints: 2 });

    expect(summary.bulletPoints).toHaveLength(2);
    expect(summary.bulletPoints[0]).toBe("T. rex is represented.");
    expect(summary.bulletPoints[1]).toBe("It lived in the Late Cretaceous.");
    expect(summary.bulletPoints).not.toContain("T.");
  });

  it("handles the other common genus abbreviations", async () => {
    const summary = await summarize({
      abstract: "G. iguanodon is described here. The material is from the Morrison Formation.",
    });

    expect(summary.bulletPoints).toEqual([
      "G. iguanodon is described here.",
      "The material is from the Morrison Formation.",
    ]);
  });

  it("keeps open nomenclature and ranks in one sentence", async () => {
    const summary = await summarize({
      abstract:
        "Ceratopsia sp. nov. is described. Specimens were referred to cf. Triceratops and assigned to a new subspecies.",
    });

    expect(summary.bulletPoints).toEqual([
      "Ceratopsia sp. nov. is described.",
      "Specimens were referred to cf. Triceratops and assigned to a new subspecies.",
    ]);
  });

  it("still splits ordinary sentences", async () => {
    const summary = await summarize({
      abstract: "The specimen is 1.5 m long. It was found in Fig. 3 of the paper! Is that clear?",
    });

    expect(summary.bulletPoints).toEqual([
      "The specimen is 1.5 m long.",
      "It was found in Fig. 3 of the paper!",
      "Is that clear?",
    ]);
  });

  it("still splits after a known abbreviation", async () => {
    const summary = await summarize({
      abstract: "Smith et al. described the taxon. The holotype is complete.",
    });

    expect(summary.bulletPoints).toEqual([
      "Smith et al. described the taxon.",
      "The holotype is complete.",
    ]);
  });

  it("requires an abstract", async () => {
    const result = await toolRegistry.execute("literature_summary", { title: "no abstract" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("abstract is required");
  });
});
