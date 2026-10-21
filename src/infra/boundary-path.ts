// Exposes boundary path resolution helpers with fs-safe defaults.
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import { resolvePathViaExistingAncestorSync as resolvePathViaExistingAncestorSyncRaw } from "@openclaw/fs-safe/advanced";
import { safeRealpathSync } from "@openclaw/fs-safe/path";
export { safeRealpathSync } from "@openclaw/fs-safe/path";

// Bun follow-up: Remove this stable frame after fs-safe drops its N-API realpath
// workaround for oven-sh/bun#42374. Its process-lived callback must not retain
// the first request context that resolves a missing path.
const runInBoundaryPathContext = AsyncLocalStorage.snapshot();

export function resolvePathViaExistingAncestorSync(targetPath: string): string {
  return runInBoundaryPathContext(resolvePathViaExistingAncestorSyncRaw, targetPath);
}

/** Returns a canonical path when resolvable, otherwise an absolute lexical path. */
export function resolveRealpathOrAbsolute(value: string): string {
  return safeRealpathSync(value) ?? path.resolve(value);
}

export function resolveIdentityPathViaExistingAncestorSync(targetPath: string): string {
  const fallback = path.resolve(targetPath);
  const missingSegments: string[] = [];
  let cursor = fallback;

  while (true) {
    try {
      // Identity aliases must converge even after an intermediate realpath failure,
      // or ownership and lock callers can split one resource into separate identities.
      return path.join(fs.realpathSync.native(cursor), ...missingSegments.toReversed());
    } catch {
      const parent = path.dirname(cursor);
      if (parent === cursor) {
        return fallback;
      }
      missingSegments.push(path.basename(cursor));
      cursor = parent;
    }
  }
}

// Boundary path resolution keeps alias expansion and realpath checks in one
// shared contract before file IO happens.
export { resolveRootPath, resolveRootPathSync } from "@openclaw/fs-safe/advanced";

// --- PaleoClaw 兼容层：BOUNDARY_PATH_ALIAS_POLICIES（pc 3 月 API，上游 10 月已改名）---
export const BOUNDARY_PATH_ALIAS_POLICIES = {
  strict: Object.freeze({
    allowFinalSymlinkForUnlink: false,
    allowFinalHardlinkForUnlink: false,
  }),
  unlinkTarget: Object.freeze({
    allowFinalSymlinkForUnlink: true,
    allowFinalHardlinkForUnlink: true,
  }),
} as const;

// --- PaleoClaw 兼容层：resolveBoundaryPath（pc 3 月 API，上游 10 月已改名）---
export async function resolveBoundaryPath(
  params: ResolveBoundaryPathParams,
): Promise<ResolvedBoundaryPath> {
  const rootPath = path.resolve(params.rootPath);
  const absolutePath = path.resolve(params.absolutePath);
  const rootCanonicalPath = params.rootCanonicalPath
    ? path.resolve(params.rootCanonicalPath)
    : await resolvePathViaExistingAncestor(rootPath);
  const context = createBoundaryResolutionContext({
    resolveParams: params,
    rootPath,
    absolutePath,
    rootCanonicalPath,
    outsideLexicalCanonicalPath: await resolveOutsideLexicalCanonicalPathAsync({
      rootPath,
      absolutePath,
    }),
  });

  const outsideResult = await resolveOutsideBoundaryPathAsync({
    boundaryLabel: params.boundaryLabel,
    context,
  });
  if (outsideResult) {
    return outsideResult;
  }

  return resolveBoundaryPathLexicalAsync({
    params,
    absolutePath: context.absolutePath,
    rootPath: context.rootPath,
    rootCanonicalPath: context.rootCanonicalPath,
  });
}
