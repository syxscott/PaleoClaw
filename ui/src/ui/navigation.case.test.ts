import { describe, expect, it } from "vitest";

import { inferBasePathFromPathname } from "./navigation.ts";

describe("inferBasePathFromPathname - case sensitivity (regression #F2)", () => {
  it("lowercases the base path when input is mixed/upper case", () => {
    expect(inferBasePathFromPathname("/APPS/PALEOCLAW/CRON")).toBe("/apps/paleoclaw");
    expect(inferBasePathFromPathname("/Ui/Chat")).toBe("/ui");
    expect(inferBasePathFromPathname("/Ui/Sessions")).toBe("/ui");
  });

  it("lowercases the fallback path when no tab is matched", () => {
    expect(inferBasePathFromPathname("/APPS/PALEOCLAW/UNKNOWN")).toBe(
      "/apps/paleoclaw/unknown",
    );
  });

  it("still returns the existing canonical values for lowercase input", () => {
    expect(inferBasePathFromPathname("/")).toBe("");
    expect(inferBasePathFromPathname("/chat")).toBe("");
    expect(inferBasePathFromPathname("/ui/chat")).toBe("/ui");
    expect(inferBasePathFromPathname("/apps/paleoclaw/sessions")).toBe("/apps/paleoclaw");
  });
});
