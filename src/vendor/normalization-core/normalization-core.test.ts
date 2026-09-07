import { describe, expect, it } from "vitest";
import { estimateStringChars, estimateTokensFromChars } from "./cjk-chars.js";
import {
  MAX_TIMER_TIMEOUT_MS,
  asPositiveFiniteNumber,
  parseFiniteNumber,
  parseStrictInteger,
  resolvePositiveTimerTimeoutMs,
} from "./number-coercion.js";
import { stableStringify } from "./stable-stringify.js";
import { sliceUtf16Safe, truncateUtf16Safe } from "./utf16-slice.js";
import { truncateCodePoints } from "./code-points.js";

describe("number coercion", () => {
  it("parses strict finite numbers and falls back on invalid input", () => {
    expect(parseFiniteNumber("12")).toBe(12);
    expect(parseFiniteNumber(" 3.5 ")).toBe(3.5);
    expect(parseFiniteNumber("1e3")).toBe(1000);
    expect(parseFiniteNumber("abc")).toBeUndefined();
    expect(parseFiniteNumber("0x10")).toBeUndefined();
    expect(parseFiniteNumber(undefined)).toBeUndefined();
  });

  it("rejects partial numbers in strict integer parsing", () => {
    expect(parseStrictInteger("20")).toBe(20);
    expect(parseStrictInteger("2.5")).toBeUndefined();
    expect(parseStrictInteger("12abc")).toBeUndefined();
    expect(parseStrictInteger(3.2)).toBeUndefined();
  });

  it("keeps positive-number guards and timer fallbacks intact", () => {
    expect(asPositiveFiniteNumber(0)).toBeUndefined();
    expect(asPositiveFiniteNumber(2)).toBe(2);
    expect(resolvePositiveTimerTimeoutMs(undefined, 20)).toBe(20);
    expect(resolvePositiveTimerTimeoutMs(-5, 20)).toBe(20);
    expect(resolvePositiveTimerTimeoutMs(Number.MAX_SAFE_INTEGER, 20)).toBe(MAX_TIMER_TIMEOUT_MS);
  });
});

describe("stable-stringify", () => {
  it("is deterministic regardless of key insertion order", () => {
    expect(stableStringify({ b: 1, a: { d: 4, c: 3 } })).toBe(
      stableStringify({ a: { c: 3, d: 4 }, b: 1 }),
    );
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("handles cycles, errors, and non-finite numbers", () => {
    const cyclic: Record<string, unknown> = { name: "loop" };
    cyclic.self = cyclic;
    expect(stableStringify(cyclic)).toBe('{"name":"loop","self":"[Circular]"}');

    const error = new TypeError("nope");
    expect(stableStringify(error)).toBe(
      JSON.stringify({ name: "TypeError", message: "nope", stack: error.stack }),
    );

    expect(stableStringify(Number.NaN)).toBe('"NaN"');
    expect(stableStringify(1n)).toBe('"1"');
  });
});

describe("cjk-aware text helpers", () => {
  it("weights CJK text higher than ASCII for token estimates", () => {
    expect(estimateStringChars("abcd")).toBe(4);
    expect(estimateStringChars("中文")).toBe(8);
    expect(estimateTokensFromChars(8)).toBe(2);
  });

  it("truncates by code points without splitting emoji surrogate pairs", () => {
    const emoji = "😀😀😀";
    const truncated = truncateCodePoints(emoji, 2);
    expect(truncated).toBe("😀😀");
    expect([...truncated]).toHaveLength(2);
  });

  it("truncates UTF-16 slices at surrogate boundaries", () => {
    expect(truncateUtf16Safe("a😀b", 2)).toBe("a");
    expect(sliceUtf16Safe("a😀b", 1, 3)).toBe("😀");
  });
});
