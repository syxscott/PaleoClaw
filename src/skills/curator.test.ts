import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { SkillMeta, isCuratorEnabled, recordSkillUse, runCurator } from './curator.js';

const NOW = new Date('2026-09-07T12:00:00.000Z');
const STALE = '2026-07-01T00:00:00.000Z'; // more than 30 days before NOW
const FRESH = '2026-09-06T00:00:00.000Z'; // less than 30 days before NOW

const tempDirs: string[] = [];

function createTempRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paleoclaw-curator-test-'));
  tempDirs.push(dir);
  return dir;
}

function createSkill(root: string, id: string, meta?: SkillMeta): string {
  const dir = path.join(root, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `# ${id}\n`, 'utf-8');
  if (meta) {
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
  }
  return dir;
}

function readMeta(root: string, id: string): SkillMeta {
  return JSON.parse(fs.readFileSync(path.join(root, id, 'meta.json'), 'utf-8')) as SkillMeta;
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('isCuratorEnabled', () => {
  it('is disabled by default', () => {
    expect(isCuratorEnabled()).toBe(false);
  });

  it('honors the env switch', () => {
    vi.stubEnv('PALEOCLAW_ENABLE_SKILL_CURATOR', '1');
    expect(isCuratorEnabled()).toBe(true);

    vi.stubEnv('PALEOCLAW_ENABLE_SKILL_CURATOR', '0');
    expect(isCuratorEnabled()).toBe(false);
  });
});

describe('runCurator', () => {
  it('archives stale unpinned skills and never deletes data', () => {
    const root = createTempRoot();
    createSkill(root, 'stale-skill', { lastUsedAt: STALE });
    createSkill(root, 'fresh-skill', { lastUsedAt: FRESH });

    const report = runCurator({ skillsRoot: root, now: NOW });

    expect(report.archived).toEqual(['stale-skill']);
    expect(report.untouched).toEqual(['fresh-skill']);
    expect(readMeta(root, 'stale-skill').archived).toBe(true);
    // The curator never deletes: skill files survive archiving.
    expect(fs.existsSync(path.join(root, 'stale-skill', 'SKILL.md'))).toBe(true);
  });

  it('computes the report but writes nothing when dryRun is set', () => {
    const root = createTempRoot();
    createSkill(root, 'stale-skill', { lastUsedAt: STALE });

    const report = runCurator({ skillsRoot: root, now: NOW, dryRun: true });

    expect(report.archived).toEqual(['stale-skill']);
    expect(readMeta(root, 'stale-skill').archived).toBeUndefined();
  });

  it('reactivates archived skills that were touched again', () => {
    const root = createTempRoot();
    createSkill(root, 'back-in-use', { lastUsedAt: FRESH, archived: true });

    const report = runCurator({ skillsRoot: root, now: NOW });

    expect(report.reactivated).toEqual(['back-in-use']);
    expect(readMeta(root, 'back-in-use').archived).toBe(false);
  });

  it('leaves skills with unknown activity untouched', () => {
    const root = createTempRoot();
    createSkill(root, 'no-meta');
    createSkill(root, 'bad-date', { lastUsedAt: 'not-a-date' });

    const report = runCurator({ skillsRoot: root, now: NOW });

    expect(report.archived).toEqual([]);
    expect(report.untouched).toEqual(['bad-date', 'no-meta']);
    expect(report.unknownActivity).toEqual(['bad-date', 'no-meta']);
    expect(fs.existsSync(path.join(root, 'no-meta', 'meta.json'))).toBe(false);
  });

  it('skips pinned skills', () => {
    const root = createTempRoot();
    createSkill(root, 'pinned-skill', { lastUsedAt: STALE, pinned: true });

    const report = runCurator({ skillsRoot: root, now: NOW });

    expect(report.archived).toEqual([]);
    expect(report.untouched).toEqual(['pinned-skill']);
    expect(readMeta(root, 'pinned-skill').archived).toBeUndefined();
  });

  it('keeps already-archived stale skills untouched', () => {
    const root = createTempRoot();
    createSkill(root, 'still-stale', { lastUsedAt: STALE, archived: true });

    const report = runCurator({ skillsRoot: root, now: NOW });

    expect(report.archived).toEqual([]);
    expect(report.untouched).toEqual(['still-stale']);
  });

  it('respects a custom inactivity window', () => {
    const root = createTempRoot();
    createSkill(root, 'recent-ish', { lastUsedAt: '2026-08-20T00:00:00.000Z' });

    const strict = runCurator({ skillsRoot: root, now: NOW, inactivityDays: 7, dryRun: true });
    const lenient = runCurator({ skillsRoot: root, now: NOW, inactivityDays: 60, dryRun: true });

    expect(strict.archived).toEqual(['recent-ish']);
    expect(lenient.archived).toEqual([]);
  });

  it('reports corrupt meta.json as an error instead of throwing', () => {
    const root = createTempRoot();
    const dir = createSkill(root, 'corrupt-skill');
    fs.writeFileSync(path.join(dir, 'meta.json'), '{not json', 'utf-8');

    const report = runCurator({ skillsRoot: root, now: NOW });

    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain('corrupt-skill');
    expect(report.archived).toEqual([]);
  });

  it('reports a missing skillsRoot as an error instead of throwing', () => {
    const report = runCurator({ skillsRoot: path.join(createTempRoot(), 'missing'), now: NOW });

    expect(report.errors).toHaveLength(1);
    expect(report.archived).toEqual([]);
    expect(report.reactivated).toEqual([]);
  });
});

describe('recordSkillUse', () => {
  it('creates activity metadata on first use', () => {
    const root = createTempRoot();
    createSkill(root, 'used-skill');

    const meta = recordSkillUse(root, 'used-skill', NOW);

    expect(meta.useCount).toBe(1);
    expect(meta.lastUsedAt).toBe('2026-09-07T12:00:00.000Z');
    expect(readMeta(root, 'used-skill')).toEqual(meta);
  });

  it('increments useCount and preserves existing metadata', () => {
    const root = createTempRoot();
    createSkill(root, 'used-skill', { pinned: true, useCount: 2 });

    recordSkillUse(root, 'used-skill', NOW);

    const meta = readMeta(root, 'used-skill');
    expect(meta.useCount).toBe(3);
    expect(meta.pinned).toBe(true);
  });

  it('feeds the curator: a recorded skill is reactivated instead of archived', () => {
    const root = createTempRoot();
    createSkill(root, 'revived', { lastUsedAt: STALE });

    runCurator({ skillsRoot: root, now: NOW });
    recordSkillUse(root, 'revived', NOW);
    const report = runCurator({ skillsRoot: root, now: NOW });

    expect(report.reactivated).toEqual(['revived']);
  });
});
