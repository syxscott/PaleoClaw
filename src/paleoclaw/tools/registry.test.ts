import { describe, expect, it } from 'vitest';

import { ToolRegistry } from './registry.js';

describe('ToolRegistry', () => {
  it('registers and executes tools', async () => {
    const registry = new ToolRegistry();

    registry.register({
      name: 'echo',
      category: 'utility',
      description: 'Echo params',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
      },
      handler: (params) => ({ message: params.message || '' }),
    });

    const result = await registry.execute('echo', { message: 'hello' });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ message: 'hello' });
  });

  it('returns error when tool is missing', async () => {
    const registry = new ToolRegistry();
    const result = await registry.execute('missing_tool');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Tool not found');
  });

  it('respects tool availability checks', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'blocked',
      category: 'utility',
      description: 'Blocked tool',
      schema: { type: 'object', properties: {} },
      handler: () => 'ok',
      checkAvailability: () => false,
    });

    const result = await registry.execute('blocked');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Tool unavailable');
  });
});
