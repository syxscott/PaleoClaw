/** Parses explicit `PaleoHub:<name>[@version]` package specs for PaleoHub installs. */
export function parseClawHubPluginSpec(raw: string): {
  name: string;
  version?: string;
  baseUrl?: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith("PaleoHub:")) {
    return null;
  }
  const spec = trimmed.slice("PaleoHub:".length).trim();
  if (!spec) {
    return null;
  }
  const atIndex = spec.lastIndexOf("@");
  if (atIndex <= 0) {
    return { name: spec };
  }
  if (atIndex >= spec.length - 1) {
    return null;
  }
  const name = spec.slice(0, atIndex).trim();
  const version = spec.slice(atIndex + 1).trim();
  if (!name || !version) {
    return null;
  }
  return {
    name,
    version,
  };
}
