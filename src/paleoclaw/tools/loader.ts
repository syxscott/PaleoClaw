/**
 * PaleoClaw built-in tool loader
 */

import { toolRegistry } from './registry.js';

// Guard against concurrent callers: a shared "in-flight" promise ensures the
// second caller awaits the first's imports instead of duplicating them.
let loading: Promise<void> | null = null;

export async function loadBuiltinTools(): Promise<void> {
  if (loading) {
    return loading;
  }

  loading = (async () => {
    await import('./pbdb-query.js');
    await import('./crossref-search.js');
    await import('./literature-summary.js');
  })().catch((err) => {
    // Reset so the next caller can retry instead of awaiting a permanently
    // rejected promise (which would brick tool loading for the process).
    loading = null;
    throw err;
  });

  return loading;
}

export async function discoverTools() {
  await loadBuiltinTools();
  return toolRegistry.list();
}
