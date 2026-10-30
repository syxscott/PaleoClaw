// Tests package tag parsing and stable release tag behavior.
import { describe, expect, it } from "vitest";
import { normalizePackageTagInput } from "./package-tag.js";

describe("normalizePackageTagInput", () => {
  const packageNames = ["paleoclaw", "@paleoclaw/plugin"] as const;

  it.each([
    { input: undefined, expected: null },
    { input: "   ", expected: null },
    { input: "paleoclaw@beta", expected: "beta" },
    { input: "@paleoclaw/plugin@2026.2.24", expected: "2026.2.24" },
    { input: "paleoclaw@   ", expected: null },
    { input: "paleoclaw", expected: null },
    { input: " @paleoclaw/plugin ", expected: null },
    { input: " latest ", expected: "latest" },
    { input: "@other/plugin@beta", expected: "@other/plugin@beta" },
    { input: "openclawer@beta", expected: "openclawer@beta" },
  ] satisfies ReadonlyArray<{ input: string | undefined; expected: string | null }>)(
    "normalizes %j",
    ({ input, expected }) => {
      expect(normalizePackageTagInput(input, packageNames)).toBe(expected);
    },
  );
});
