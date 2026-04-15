import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isAutoToolsEnabled,
  isMemoryContextEnabled,
  isSessionAutosaveEnabled,
} from './runtime-switches.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('runtime integration switches', () => {
  it('defaults to enabled', () => {
    expect(isAutoToolsEnabled()).toBe(true);
    expect(isMemoryContextEnabled()).toBe(true);
    expect(isSessionAutosaveEnabled()).toBe(true);
  });

  it('honors explicit false values', () => {
    vi.stubEnv('PALEOCLAW_ENABLE_AUTO_TOOLS', 'false');
    vi.stubEnv('PALEOCLAW_ENABLE_MEMORY_CONTEXT', '0');
    vi.stubEnv('PALEOCLAW_ENABLE_SESSION_AUTOSAVE', 'off');

    expect(isAutoToolsEnabled()).toBe(false);
    expect(isMemoryContextEnabled()).toBe(false);
    expect(isSessionAutosaveEnabled()).toBe(false);
  });

  it('honors explicit true values', () => {
    vi.stubEnv('PALEOCLAW_ENABLE_AUTO_TOOLS', 'yes');
    vi.stubEnv('PALEOCLAW_ENABLE_MEMORY_CONTEXT', '1');
    vi.stubEnv('PALEOCLAW_ENABLE_SESSION_AUTOSAVE', 'on');

    expect(isAutoToolsEnabled()).toBe(true);
    expect(isMemoryContextEnabled()).toBe(true);
    expect(isSessionAutosaveEnabled()).toBe(true);
  });
});
