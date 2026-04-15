import { describe, expect, it } from 'vitest';

import {
  buildMemoryContextBlock,
  MemoryManager,
  sanitizeContext,
} from './manager.js';
import type { MemoryProvider } from './provider.js';

describe('memory manager', () => {
  it('sanitizes and wraps context in memory fence', () => {
    const raw = '<memory-context>hello\nworld</memory-context>';
    expect(sanitizeContext(raw)).toBe('hello\nworld');

    const block = buildMemoryContextBlock(raw);
    expect(block).toContain('<memory-context>');
    expect(block).toContain('hello');
    expect(block).toContain('</memory-context>');
  });

  it('allows only one external provider', () => {
    const manager = new MemoryManager();

    const externalA: MemoryProvider = { name: 'ext-a', isBuiltin: false };
    const externalB: MemoryProvider = { name: 'ext-b', isBuiltin: false };

    manager.addProvider(externalA);
    expect(() => manager.addProvider(externalB)).toThrow(/Only one external memory provider/);
  });

  it('prefetches and fences provider content', async () => {
    const manager = new MemoryManager();
    manager.addProvider({
      name: 'builtin',
      isBuiltin: true,
      prefetch: () => 'remembered-line',
    });

    const context = await manager.prefetchAll('query');
    expect(context).toContain('[builtin]');
    expect(context).toContain('remembered-line');
    expect(context.startsWith('<memory-context>')).toBe(true);
  });
});
