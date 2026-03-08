import { describe, expect, it } from "vitest";
import { shortenText } from "./text-format.js";

describe("shortenText", () => {
  it("returns original text when it fits", () => {
    expect(shortenText("paleoclaw", 16)).toBe("paleoclaw");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(shortenText("paleoclaw-status-output", 10)).toBe("paleoclaw-…");
  });

  it("counts multi-byte characters correctly", () => {
    expect(shortenText("hello🙂world", 7)).toBe("hello🙂…");
  });
});
