// Loads and saves JSON files with symlink backup handling.
import fs from "node:fs";
import path from "node:path";
import { resolvePathPrefixSync } from "@openclaw/fs-safe/advanced";
import { tryReadJsonSync, writeJsonSync } from "@openclaw/fs-safe/json";
import { hasNodeErrorCode } from "@openclaw/fs-safe/path";

function resolveJsonSaveTarget(pathname: string): string {
  if (!fs.lstatSync(pathname, { throwIfNoEntry: false })?.isSymbolicLink()) {
    return pathname;
  }
  const resolved = resolvePathPrefixSync(pathname);
  const target = [resolved.existingPath, ...resolved.unresolvedSegments].join(path.sep);
  fs.statSync(path.dirname(target));
  return target;
}

export function writeJsonTarget(pathname: string, data: unknown): void {
  writeJsonSync(resolveJsonSaveTarget(pathname), data);
}

// oxlint-disable-next-line typescript-eslint/no-unnecessary-type-parameters -- legacy typed JSON loader alias.
export function loadJsonFileThroughSymlink<T = unknown>(pathname: string): T | undefined {
  let resolved: string;
  try {
    resolved = fs.realpathSync(pathname);
  } catch (error) {
    if (hasNodeErrorCode(error, "ENOENT") || hasNodeErrorCode(error, "ELOOP")) {
      return undefined;
    }
    throw error;
  }
  return tryReadJsonSync<T>(resolved) ?? undefined;
}

// --- PaleoClaw 兼容层：loadJsonFile（pc 3 月 API，上游 10 月已改名）---
export function loadJsonFile(pathname: string): unknown {
  try {
    if (!fs.existsSync(pathname)) {
      return undefined;
    }
    const raw = fs.readFileSync(pathname, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

// --- PaleoClaw 兼容层：saveJsonFile（pc 3 月 API，上游 10 月已改名）---
export function saveJsonFile(pathname: string, data: unknown) {
  const dir = path.dirname(pathname);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(pathname, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.chmodSync(pathname, 0o600);
}
