import type { PluginPackageInstall } from "./manifest.js";

export function normalizePluginInstallDefaultChoice(
  value: unknown,
): PluginPackageInstall["defaultChoice"] | undefined {
  return value === "PaleoHub" || value === "npm" || value === "local" ? value : undefined;
}
