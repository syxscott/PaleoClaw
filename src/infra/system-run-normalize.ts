export { normalizeNullableString as normalizeNonEmptyString } from "@paleoclaw/normalization-core/string-coerce";
export { readNonBlankString } from "@paleoclaw/normalization-core/string-coerce";

/** Coerces array entries to allow-list strings while rejecting non-array inputs. */
export function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}
