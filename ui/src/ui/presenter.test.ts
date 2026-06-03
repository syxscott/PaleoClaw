import { describe, expect, it } from "vitest";

import { formatSessionTokens } from "./presenter.ts";

describe("formatSessionTokens (regression #F3)", () => {
  it("returns 'n/a' when totalTokens is null or undefined", () => {
    expect(formatSessionTokens({ totalTokens: null })).toBe("n/a");
    expect(formatSessionTokens({ totalTokens: undefined })).toBe("n/a");
  });

  it("returns 'total / context' when contextTokens is a finite number, including 0", () => {
    expect(formatSessionTokens({ totalTokens: 100, contextTokens: 200 })).toBe("100 / 200");
    expect(formatSessionTokens({ totalTokens: 100, contextTokens: 0 })).toBe("100 / 0");
  });

  it("returns just the total when contextTokens is missing", () => {
    expect(formatSessionTokens({ totalTokens: 100 })).toBe("100");
    expect(formatSessionTokens({ totalTokens: 0 })).toBe("0");
  });
});
