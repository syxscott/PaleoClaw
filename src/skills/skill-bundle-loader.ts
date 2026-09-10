import * as fs from "fs";
import * as path from "path";
import {
  loadSkillBundle,
  addSkillBundle,
  getSkillBundlesDirectory,
  setSkillBundlesDirectory,
  SkillBundle,
} from "./skill-bundles.js";

const BUNDLE_MTIMES = new Map<string, number>();

export async function scanBundleDirectory(dir?: string): Promise<string[]> {
  const bundleDir = dir || getSkillBundlesDirectory();
  if (!bundleDir) return [];

  if (!fs.existsSync(bundleDir)) {
    return [];
  }

  const loaded: string[] = [];

  try {
    const files = fs.readdirSync(bundleDir);

    for (const file of files) {
      if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;

      const fullPath = path.join(bundleDir, file);
      const stat = fs.statSync(fullPath);

      // Check if file has changed since last load
      const lastMtime = BUNDLE_MTIMES.get(fullPath);
      if (lastMtime && stat.mtimeMs <= lastMtime) continue;

      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        const bundle = await loadSkillBundle(content, fullPath);
        addSkillBundle(bundle);
        BUNDLE_MTIMES.set(fullPath, stat.mtimeMs);
        loaded.push(bundle.name);
      } catch (err) {
        console.warn(`Failed to load skill bundle from ${fullPath}:`, err);
      }
    }
  } catch (err) {
    console.error(`Failed to scan bundle directory ${bundleDir}:`, err);
  }

  return loaded;
}

export function initializeSkillBundles(dir: string): void {
  setSkillBundlesDirectory(dir);
  scanBundleDirectory(dir);
}

export function watchBundleDirectory(dir?: string): fs.FSWatcher | null {
  const bundleDir = dir || getSkillBundlesDirectory();
  if (!bundleDir || !fs.existsSync(bundleDir)) return null;

  try {
    const watcher = fs.watch(bundleDir, { recursive: false }, (eventType, filename) => {
      if (filename && (filename.endsWith(".yaml") || filename.endsWith(".yml"))) {
        console.log(`Skill bundle file changed: ${filename}, reloading...`);
        scanBundleDirectory(bundleDir);
      }
    });

    return watcher;
  } catch (err) {
    console.error(`Failed to watch bundle directory:`, err);
    return null;
  }
}
