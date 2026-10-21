// Root-bounded directory walking facade for explicit plugin SDK consumers.
import { root, type RootWalkEntry, type RootWalkOptions } from "@paleoclaw/fs-safe/root";

export type { RootWalkEntry, RootWalkOptions } from "@paleoclaw/fs-safe/root";

export async function* walkRootDirectory(
  rootDir: string,
  relativePath: string,
  options: RootWalkOptions,
): AsyncGenerator<RootWalkEntry> {
  const capability = await root(rootDir);
  yield* capability.walk(relativePath, options);
}
