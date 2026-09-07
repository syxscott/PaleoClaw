import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { PipelineEntry, loadPipelineRegistry, runPipeline } from './pipeline-registry.js';

const tempDirs: string[] = [];

function createTempRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paleoclaw-pipeline-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function writeRegistry(root: string, content: unknown): string {
  const registryPath = path.join(root, 'skills_registry.json');
  fs.writeFileSync(registryPath, JSON.stringify(content, null, 2), 'utf-8');
  return registryPath;
}

function makeResolver(...entries: PipelineEntry[]): (id: string) => PipelineEntry | undefined {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return (id) => byId.get(id);
}

describe('loadPipelineRegistry', () => {
  it('loads valid entries from a { skills: [...] } registry', () => {
    const root = createTempRoot();
    const registryPath = writeRegistry(root, {
      version: '1.0',
      skills: [
        {
          id: 'stratigraphy_context',
          type: 'pipeline',
          description: 'Build stratigraphy context for a taxon',
          steps: [{ tool: 'pbdb_query', params: { taxon: 'Allosaurus' } }],
          output: 'report.md',
        },
      ],
    });

    const { entries, errors } = loadPipelineRegistry(registryPath);

    expect(errors).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe('stratigraphy_context');
    expect(entries[0]?.steps[0]?.tool).toBe('pbdb_query');
    expect(entries[0]?.steps[0]?.params).toEqual({ taxon: 'Allosaurus' });
    expect(entries[0]?.output).toBe('report.md');
  });

  it('accepts a top-level array registry', () => {
    const root = createTempRoot();
    const registryPath = writeRegistry(root, [
      { id: 'geo_variables', type: 'pipeline', steps: [{ tool: 'geo_variables' }] },
    ]);

    const { entries, errors } = loadPipelineRegistry(registryPath);

    expect(errors).toEqual([]);
    expect(entries.map((entry) => entry.id)).toEqual(['geo_variables']);
  });

  it('skips invalid entries with a reason and keeps valid ones', () => {
    const root = createTempRoot();
    const registryPath = writeRegistry(root, [
      { id: 'good', type: 'pipeline', steps: [{ tool: 'pbdb_query' }] },
      { id: 'no-steps', type: 'pipeline' },
      { id: 'wrong-type', type: 'ai', steps: [] },
      { type: 'pipeline', steps: [] },
      { id: 'bad-step', type: 'pipeline', steps: [{ params: {} }] },
      { id: 'good', type: 'pipeline', steps: [] },
    ]);

    const { entries, errors } = loadPipelineRegistry(registryPath);

    expect(entries.map((entry) => entry.id)).toEqual(['good']);
    expect(errors).toHaveLength(5);
    expect(errors.every((error) => error.reason.length > 0)).toBe(true);
    expect(errors.at(-1)?.id).toBe('good');
  });

  it('reports file-level problems as errors instead of throwing', () => {
    const root = createTempRoot();

    const missing = loadPipelineRegistry(path.join(root, 'missing.json'));
    expect(missing.entries).toEqual([]);
    expect(missing.errors).toHaveLength(1);

    const badJsonPath = path.join(root, 'bad.json');
    fs.writeFileSync(badJsonPath, '{nope', 'utf-8');
    const badJson = loadPipelineRegistry(badJsonPath);
    expect(badJson.entries).toEqual([]);
    expect(badJson.errors).toHaveLength(1);
  });
});

describe('runPipeline', () => {
  it('runs pre-skills (memoized) then steps in order', async () => {
    const cEntry: PipelineEntry = { id: 'c', type: 'pipeline', steps: [{ tool: 'geo_variables', params: {} }] };
    const bEntry: PipelineEntry = { id: 'b', type: 'pipeline', pre: ['c'], steps: [{ tool: 'pbdb_query', params: {} }] };
    const aEntry: PipelineEntry = { id: 'a', type: 'pipeline', pre: ['b', 'c'], steps: [{ tool: 'time_rules', params: {} }] };

    const executeTool = vi.fn(async (tool: string) => `${tool}-result`);
    const report = await runPipeline(aEntry, executeTool, {
      resolveEntry: makeResolver(aEntry, bEntry, cEntry),
    });

    expect(report.ok).toBe(true);
    // 'c' is reachable from both 'b' and 'a' but executed only once.
    expect(executeTool).toHaveBeenCalledTimes(3);
    expect(executeTool).toHaveBeenCalledWith('geo_variables', {});
    expect(Object.keys(report.pre).sort()).toEqual(['b', 'c']);
    expect(report.steps).toEqual([{ tool: 'time_rules', status: 'ok', result: 'time_rules-result' }]);
  });

  it('detects cycles in the pre-skill chain', async () => {
    const aEntry: PipelineEntry = { id: 'a', type: 'pipeline', pre: ['b'], steps: [] };
    const bEntry: PipelineEntry = { id: 'b', type: 'pipeline', pre: ['a'], steps: [] };

    const report = await runPipeline(aEntry, async () => null, {
      resolveEntry: makeResolver(aEntry, bEntry),
    });

    expect(report.ok).toBe(false);
    expect(report.error).toContain('cycle');
  });

  it('aborts on step failure but keeps the report of completed steps', async () => {
    const entry: PipelineEntry = {
      id: 'boom',
      type: 'pipeline',
      steps: [
        { tool: 'works', params: {} },
        { tool: 'explodes', params: {} },
        { tool: 'never-runs', params: {} },
      ],
    };
    const executeTool = vi.fn(async (tool: string) => {
      if (tool === 'explodes') throw new Error('kaboom');
      return 'ok';
    });

    const report = await runPipeline(entry, executeTool);

    expect(report.ok).toBe(false);
    expect(report.error).toContain('explodes');
    expect(report.error).toContain('kaboom');
    expect(report.steps).toHaveLength(2);
    expect(report.steps[0]).toEqual({ tool: 'works', status: 'ok', result: 'ok' });
    expect(report.steps[1]?.status).toBe('failed');
    expect(executeTool).toHaveBeenCalledTimes(2);
  });

  it('fails when a pre-skill id cannot be resolved', async () => {
    const entry: PipelineEntry = { id: 'a', type: 'pipeline', pre: ['ghost'], steps: [] };

    const report = await runPipeline(entry, async () => null);

    expect(report.ok).toBe(false);
    expect(report.error).toContain('ghost');
  });
});
