export { resolveOpenProviderRuntimeGroupPolicy as resolveZaloRuntimeGroupPolicy } from "paleoclaw/plugin-sdk/runtime-group-policy";

const ZALO_ALLOW_FROM_PREFIX_RE = /^(zalo|zl):/i;

export function normalizeZaloAllowEntry(value: string): string {
  return value.trim().replace(ZALO_ALLOW_FROM_PREFIX_RE, "").trim().toLowerCase();
}
