/**
 * Skill lifecycle curator (deterministic core, ported from Hermes agent/curator.py).
 *
 * Skills carry activity metadata in a `meta.json` file inside each skill
 * bundle directory: `{ lastUsedAt?, useCount?, pinned?, archived? }`.
 *
 * The curator NEVER deletes anything — it only flips `archived` to true/false.
 * It is not wired into any runtime path: gate it with `isCuratorEnabled()`
 * and invoke `runCurator()` explicitly from CLI/ops tooling. Callers feed
 * activity via `recordSkillUse()`.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SkillMeta {
  lastUsedAt?: string;
  useCount?: number;
  pinned?: boolean;
  archived?: boolean;
}

export interface CuratorOptions {
  skillsRoot: string;
  now?: Date;
  inactivityDays?: number;
  dryRun?: boolean;
}

export interface CuratorReport {
  archived: string[];
  reactivated: string[];
  untouched: string[];
  errors: string[];
  /** Skills with no usable lastUsedAt; always left untouched, never archived. */
  unknownActivity: string[];
}

const DEFAULT_INACTIVITY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function readEnvFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) {
    return defaultValue;
  }

  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

export function isCuratorEnabled(): boolean {
  return readEnvFlag('PALEOCLAW_ENABLE_SKILL_CURATOR', false);
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function metaPathFor(skillsRoot: string, skillId: string): string {
  return path.join(skillsRoot, skillId, 'meta.json');
}

function readSkillMeta(skillsRoot: string, skillId: string): { meta: SkillMeta; error?: string } {
  const metaPath = metaPathFor(skillsRoot, skillId);
  if (!fs.existsSync(metaPath)) {
    return { meta: {} };
  }

  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { meta: {}, error: `${skillId}: meta.json is not an object` };
    }
    return { meta: parsed as SkillMeta };
  } catch (err) {
    return { meta: {}, error: `${skillId}: failed to read meta.json: ${describeError(err)}` };
  }
}

function writeSkillMeta(skillsRoot: string, skillId: string, meta: SkillMeta): string | undefined {
  try {
    fs.writeFileSync(metaPathFor(skillsRoot, skillId), `${JSON.stringify(meta, null, 2)}\n`, 'utf-8');
    return undefined;
  } catch (err) {
    return `${skillId}: failed to write meta.json: ${describeError(err)}`;
  }
}

export function runCurator(opts: CuratorOptions): CuratorReport {
  const now = opts.now ?? new Date();
  const inactivityDays = opts.inactivityDays ?? DEFAULT_INACTIVITY_DAYS;
  const cutoffMs = now.getTime() - inactivityDays * DAY_MS;

  const report: CuratorReport = {
    archived: [],
    reactivated: [],
    untouched: [],
    errors: [],
    unknownActivity: [],
  };

  if (!opts.skillsRoot || !fs.existsSync(opts.skillsRoot)) {
    report.errors.push(`skillsRoot not found: ${opts.skillsRoot}`);
    return report;
  }

  let skillIds: string[];
  try {
    skillIds = fs
      .readdirSync(opts.skillsRoot, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .sort();
  } catch (err) {
    report.errors.push(`failed to list skillsRoot ${opts.skillsRoot}: ${describeError(err)}`);
    return report;
  }

  for (const skillId of skillIds) {
    const { meta, error } = readSkillMeta(opts.skillsRoot, skillId);
    if (error) {
      report.errors.push(error);
      continue;
    }

    if (meta.pinned === true) {
      report.untouched.push(skillId);
      continue;
    }

    let lastUsedMs: number | undefined;
    if (meta.lastUsedAt !== undefined) {
      const parsed = new Date(meta.lastUsedAt);
      if (!Number.isNaN(parsed.getTime())) lastUsedMs = parsed.getTime();
    }

    if (lastUsedMs === undefined) {
      // Never archive on unknown activity.
      report.untouched.push(skillId);
      report.unknownActivity.push(skillId);
      continue;
    }

    const stale = lastUsedMs < cutoffMs;
    if (stale && meta.archived !== true) {
      if (!opts.dryRun) {
        const writeError = writeSkillMeta(opts.skillsRoot, skillId, { ...meta, archived: true });
        if (writeError) {
          report.errors.push(writeError);
          continue;
        }
      }
      report.archived.push(skillId);
    } else if (!stale && meta.archived === true) {
      if (!opts.dryRun) {
        const writeError = writeSkillMeta(opts.skillsRoot, skillId, { ...meta, archived: false });
        if (writeError) {
          report.errors.push(writeError);
          continue;
        }
      }
      report.reactivated.push(skillId);
    } else {
      report.untouched.push(skillId);
    }
  }

  return report;
}

export function recordSkillUse(skillsRoot: string, skillId: string, now: Date = new Date()): SkillMeta {
  const { meta, error } = readSkillMeta(skillsRoot, skillId);
  if (error) {
    throw new Error(error);
  }

  const updated: SkillMeta = {
    ...meta,
    lastUsedAt: now.toISOString(),
    useCount: (meta.useCount ?? 0) + 1,
  };

  const writeError = writeSkillMeta(skillsRoot, skillId, updated);
  if (writeError) {
    throw new Error(writeError);
  }

  return updated;
}
