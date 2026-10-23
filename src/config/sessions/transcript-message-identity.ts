import { asOptionalRecord } from "@paleoclaw/normalization-core/record-coerce";
import { normalizeNullableString } from "@paleoclaw/normalization-core/string-coerce";

export function readMessageIdempotencyKey(message: unknown): string | null {
  return normalizeNullableString(asOptionalRecord(message)?.idempotencyKey);
}
