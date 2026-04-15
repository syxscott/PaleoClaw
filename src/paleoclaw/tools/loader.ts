/**
 * PaleoClaw built-in tool loader
 */

import { toolRegistry } from './registry.js';

let loaded = false;

export async function loadBuiltinTools(): Promise<void> {
  if (loaded) {
    return;
  }

  await import('./pbdb-query.js');
  await import('./crossref-search.js');
  await import('./literature-summary.js');

  loaded = true;
}

export async function discoverTools() {
  await loadBuiltinTools();
  return toolRegistry.list();
}
