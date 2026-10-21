const OPENCLAW_BUNDLE_PLUGIN_PACKAGES = new Set([
  "@paleoclaw/acpx",
  "@paleoclaw/cloudflare",
  "@paleoclaw/diffs",
  "@paleoclaw/feishu",
]);

/**
 * @param {string} packageName
 * @returns {"" | "bundle-plugin"}
 */
export function resolveOpenClawClawHubPackageFamily(packageName) {
  return OPENCLAW_BUNDLE_PLUGIN_PACKAGES.has(packageName) ? "bundle-plugin" : "";
}
