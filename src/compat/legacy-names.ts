export const PROJECT_NAME = "paleoclaw" as const;

/**
 * Project names used before the PaleoClaw rebrand. Package manifests shipped by
 * older plugin/hook packages (and fixtures derived from them) still key their
 * metadata blocks under these names, so lookups fall back to them.
 */
export const LEGACY_PROJECT_NAMES = ["openclaw"] as const;

export const MANIFEST_KEY = PROJECT_NAME;

export const LEGACY_MANIFEST_KEYS = LEGACY_PROJECT_NAMES;

export const LEGACY_PLUGIN_MANIFEST_FILENAMES = [] as const;

export const LEGACY_CANVAS_HANDLER_NAMES = [] as const;

/**
 * Resolve a package.json manifest metadata block by its project key, falling
 * back to legacy project names for packages published before the rebrand.
 */
export function resolveManifestSection(manifest: unknown, primaryKey: string): unknown {
  if (typeof manifest !== "object" || manifest === null) {
    return undefined;
  }
  const record = manifest as Record<string, unknown>;
  const primary = record[primaryKey];
  if (primary !== undefined) {
    return primary;
  }
  for (const legacyKey of LEGACY_MANIFEST_KEYS) {
    const legacy = record[legacyKey];
    if (legacy !== undefined) {
      return legacy;
    }
  }
  return undefined;
}

export const MACOS_APP_SOURCES_DIR = "apps/macos/Sources/paleoclaw" as const;

export const LEGACY_MACOS_APP_SOURCES_DIRS = [] as const;
