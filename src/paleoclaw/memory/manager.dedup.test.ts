import { describe, expect, it } from 'vitest';

import { MemoryManager } from './manager.js';
import type { MemoryProvider } from './provider.js';

describe('MemoryManager.addProvider dedup', () => {
  it('throws when adding two providers with the same name', () => {
    const manager = new MemoryManager();
    const a: MemoryProvider = { name: 'same-name', isBuiltin: true };
    const b: MemoryProvider = { name: 'same-name', isBuiltin: true };

    manager.addProvider(a);
    expect(() => manager.addProvider(b)).toThrow(/already registered/);
  });

  it('allows different builtin providers', () => {
    const manager = new MemoryManager();
    const a: MemoryProvider = { name: 'builtin-a', isBuiltin: true };
    const b: MemoryProvider = { name: 'builtin-b', isBuiltin: true };

    manager.addProvider(a);
    manager.addProvider(b);
    expect(manager.listProviders().length).toBe(2);
  });

  it('still enforces single external provider', () => {
    const manager = new MemoryManager();
    const a: MemoryProvider = { name: 'ext-a', isBuiltin: false };
    const b: MemoryProvider = { name: 'ext-b', isBuiltin: false };

    manager.addProvider(a);
    expect(() => manager.addProvider(b)).toThrow(/Only one external memory provider/);
  });
});
