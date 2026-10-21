/**
 * Locates local paleoclaw docs/source roots for references shown to agents.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveOpenClawPackageRoot } from "../infra/paleoclaw-root.js";
import { isPathInside } from "../infra/path-guards.js";
import { resolveSandboxPathMapping } from "./path-policy.js";
import type { SandboxContext } from "./sandbox/types.js";

export const OPENCLAW_DOCS_URL = "https://docs.openclaw.ai";
export const OPENCLAW_SOURCE_URL = "https://github.com/paleoclaw/paleoclaw";

type ResolveOpenClawReferencePathParams = {
  workspaceDir?: string;
  argv1?: string;
  cwd?: string;
  moduleUrl?: string;
  sandbox?: Pick<SandboxContext, "enabled" | "fsBridge"> | null;
};

/** Resolve docs and source from one package root, preferring workspace docs. */
export async function resolveOpenClawReferencePaths(
  params: ResolveOpenClawReferencePathParams,
): Promise<{
  docsPath: string | null;
  sourcePath: string | null;
}> {
  const resolveReference = (directory: string, marker: string): string | null => {
    if (!fs.existsSync(path.join(directory, marker))) {
      return null;
    }
    if (!params.sandbox?.enabled) {
      return directory;
    }
    try {
      const hostPath = fs.realpathSync(directory);
      const bridge = params.sandbox.fsBridge;
      if (!bridge) {
        return null;
      }
      const mappings = bridge.pathMappings;
      const resolved = bridge.resolvePath({ filePath: mappings ? directory : hostPath });
      const mapped = mappings ? resolveSandboxPathMapping(mappings, resolved.containerPath) : null;
      const backingPath = mappings ? mapped?.hostPath : resolved.hostPath;
      // Preserve mount aliases, but reject shadows and symlinks outside the selected source.
      return backingPath &&
        fs.realpathSync(backingPath) === hostPath &&
        (!mapped || isPathInside(fs.realpathSync(mapped.mapping.hostRoot), hostPath))
        ? resolved.containerPath
        : null;
    } catch {
      return null;
    }
  };
  const packageRoot = await resolveOpenClawPackageRoot({
    cwd: params.cwd,
    argv1: params.argv1,
    moduleUrl: params.moduleUrl,
  });
  const workspaceDir = params.workspaceDir?.trim();
  return {
    docsPath:
      (workspaceDir ? resolveReference(path.join(workspaceDir, "docs"), "docs.json") : null) ??
      (packageRoot ? resolveReference(path.join(packageRoot, "docs"), "docs.json") : null),
    sourcePath: packageRoot ? resolveReference(packageRoot, ".git") : null,
  };
}

// --- PaleoClaw 兼容层：resolveOpenClawDocsPath（pc 3 月 API，上游 10 月已改名）---
export async function resolveOpenClawDocsPath(params: {
  workspaceDir?: string;
  argv1?: string;
  cwd?: string;
  moduleUrl?: string;
}): Promise<string | null> {
  const workspaceDir = params.workspaceDir?.trim();
  if (workspaceDir) {
    const workspaceDocs = path.join(workspaceDir, "docs");
    if (fs.existsSync(workspaceDocs)) {
      return workspaceDocs;
    }
  }

  const packageRoot = await resolveOpenClawPackageRoot({
    cwd: params.cwd,
    argv1: params.argv1,
    moduleUrl: params.moduleUrl,
  });
  if (!packageRoot) {
    return null;
  }

  const packageDocs = path.join(packageRoot, "docs");
  return fs.existsSync(packageDocs) ? packageDocs : null;
}
