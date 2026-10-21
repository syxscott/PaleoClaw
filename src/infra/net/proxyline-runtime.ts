import { createRequire } from "node:module";

export function loadProxyline(): typeof import("@paleoclaw/proxyline") {
  const require = createRequire(import.meta.url);
  // SAFETY: The pinned package's public root is described by this import type.
  return require("@paleoclaw/proxyline") as typeof import("@paleoclaw/proxyline");
}
