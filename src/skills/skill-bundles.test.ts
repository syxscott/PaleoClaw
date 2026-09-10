import { describe, expect, it } from "vitest";
import { loadSkillBundle } from "./skill-bundles.js";

describe("loadSkillBundle", () => {
  it("parses name, description, and skill lists", async () => {
    const bundle = await loadSkillBundle(
      [
        "name: Stratigraphy",
        "description: Stratigraphy helpers",
        "skills:",
        "  - pbdb_query",
        "  - geo_variables",
      ].join("\n"),
    );

    expect(bundle.name).toBe("Stratigraphy");
    expect(bundle.description).toBe("Stratigraphy helpers");
    expect(bundle.skills).toEqual(["pbdb_query", "geo_variables"]);
  });

  it("accepts inline skill entries on the skills key", async () => {
    const bundle = await loadSkillBundle("skills: pbdb_query");

    expect(bundle.skills).toEqual(["pbdb_query"]);
  });

  it("ignores list items under non-skills keys", async () => {
    const bundle = await loadSkillBundle(
      ["name: Test", "tags:", "  - not-a-skill", "skills:", "  - real-skill"].join("\n"),
    );

    expect(bundle.skills).toEqual(["real-skill"]);
  });

  it("consumes literal block scalars (key: |) for instruction", async () => {
    const bundle = await loadSkillBundle(
      [
        "name: Test",
        "instruction: |",
        "  Be terse.",
        "  Cite sources.",
        "skills:",
        "  - pbdb_query",
      ].join("\n"),
    );

    expect(bundle.instruction).toBe("Be terse.\nCite sources.");
    expect(bundle.skills).toEqual(["pbdb_query"]);
  });

  it("folds folded block scalars (key: >) into a single line", async () => {
    const bundle = await loadSkillBundle(
      ["instruction: >", "  Be terse.", "  Cite sources."].join("\n"),
    );

    expect(bundle.instruction).toBe("Be terse. Cite sources.");
  });

  it("does not treat block scalar body lines as skills", async () => {
    const bundle = await loadSkillBundle(
      ["name: Test", "instruction: |", "  - Be terse", "  - Cite sources"].join("\n"),
    );

    expect(bundle.instruction).toBe("- Be terse\n- Cite sources");
    expect(bundle.skills).toEqual([]);
  });

  it("keeps colon-bearing values intact and records provenance", async () => {
    const bundle = await loadSkillBundle(
      "description: See https://example.com",
      "/tmp/bundle.yaml",
    );

    expect(bundle.description).toBe("See https://example.com");
    expect(bundle.source).toBe("/tmp/bundle.yaml");
    expect(bundle.loadedAt).toBeInstanceOf(Date);
  });
});
