/**
 * Inbound access control for the WeCom channel.
 *
 * WeCom identifies a sender by their WeChat user id, so allowlist matching is
 * an exact comparison of the trimmed user id. "*" is the wildcard written by
 * the onboarding helpers and means "allow every enterprise member".
 */

export const WECOM_ALLOW_ALL = "*";

/** Exact-match allowlist check (with the "*" wildcard). */
export function isWecomSenderAllowed(allowFrom: string[], senderId: string): boolean {
  const sender = senderId.trim();
  if (!sender) {
    return false;
  }
  const entries = allowFrom.map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0) {
    return false;
  }
  if (entries.includes(WECOM_ALLOW_ALL)) {
    return true;
  }
  return entries.includes(sender);
}
