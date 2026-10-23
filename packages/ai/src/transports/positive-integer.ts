import {
  floorPositiveFiniteNumber,
  parseStrictPositiveInteger,
} from "@paleoclaw/normalization-core/number-coercion";

export function parsePositiveInteger(value: unknown): number | undefined {
  return typeof value === "string"
    ? parseStrictPositiveInteger(value)
    : floorPositiveFiniteNumber(value);
}
