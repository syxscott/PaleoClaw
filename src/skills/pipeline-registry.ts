/**
 * Declarative pipeline skill registry.
 *
 * Inspired by GeoClaw's configs/skills_registry.json ({id, type: pipeline|ai,
 * pipeline, pre_steps, requires_osm, report_path}) but adapted to PaleoClaw
 * conventions: each entry declares ordered tool `steps` plus optional `pre`
 * skill dependencies, and the caller owns all side effects — `runPipeline()`
 * never touches the filesystem.
 *
 * Registry JSON on disk is either a top-level array of entries or an object
 * with a `skills` array:
 *   { "id": "stratigraphy_context", "type": "pipeline", "description": "...",
 *     "steps": [{ "tool": "pbdb_query", "params": {} }],
 *     "pre": ["other_skill_id"], "output": "report.md" }
 */

import * as fs from "fs";

export interface PipelineStep {
  tool: string;
  params: Record<string, unknown>;
}

export interface PipelineEntry {
  id: string;
  type: "pipeline";
  description?: string;
  steps: PipelineStep[];
  pre?: string[];
  output?: string;
}

export interface PipelineRegistryError {
  id?: string;
  reason: string;
}

export interface PipelineRegistry {
  entries: PipelineEntry[];
  errors: PipelineRegistryError[];
}

export interface PipelineStepResult {
  tool: string;
  status: "ok" | "failed";
  result?: unknown;
  error?: string;
}

export interface PipelineRunReport {
  skillId: string;
  ok: boolean;
  /** Reports for each pre-skill dependency, keyed by skill id (memoized). */
  pre: Record<string, PipelineRunReport>;
  /** Results for every attempted step, in execution order. */
  steps: PipelineStepResult[];
  error?: string;
}

export interface PipelineRunOptions {
  /** Resolves a pre-skill id to its registry entry; unresolved ids abort the run. */
  resolveEntry?: (id: string) => PipelineEntry | undefined;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function extractEntryList(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as Record<string, unknown>).skills)
  ) {
    return (parsed as Record<string, unknown>).skills as unknown[];
  }
  return null;
}

function readId(item: unknown): string | undefined {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const id = (item as Record<string, unknown>).id;
    if (typeof id === "string") return id;
  }
  return undefined;
}

function validateEntry(item: unknown): PipelineEntry | string {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return "entry must be an object";
  }

  const record = item as Record<string, unknown>;

  const id = record.id;
  if (typeof id !== "string" || !id.trim()) {
    return "'id' must be a non-empty string";
  }

  if (record.type !== "pipeline") {
    return `'type' must be 'pipeline' (got ${JSON.stringify(record.type) ?? "undefined"})`;
  }

  const stepsRaw = record.steps;
  if (!Array.isArray(stepsRaw)) {
    return "'steps' must be an array";
  }

  const steps: PipelineStep[] = [];
  for (const stepRaw of stepsRaw) {
    if (!stepRaw || typeof stepRaw !== "object" || Array.isArray(stepRaw)) {
      return "each step must be an object";
    }
    const step = stepRaw as Record<string, unknown>;
    if (typeof step.tool !== "string" || !step.tool.trim()) {
      return "each step must have a non-empty string 'tool'";
    }
    if (
      step.params !== undefined &&
      (typeof step.params !== "object" || step.params === null || Array.isArray(step.params))
    ) {
      return "step 'params' must be an object";
    }
    steps.push({ tool: step.tool, params: (step.params as Record<string, unknown>) ?? {} });
  }

  const preRaw = record.pre;
  if (preRaw !== undefined) {
    if (
      !Array.isArray(preRaw) ||
      preRaw.some((preId) => typeof preId !== "string" || !preId.trim())
    ) {
      return "'pre' must be an array of skill ids";
    }
  }

  if (record.output !== undefined && typeof record.output !== "string") {
    return "'output' must be a string";
  }

  const entry: PipelineEntry = { id, type: "pipeline", steps };
  if (typeof record.description === "string") entry.description = record.description;
  if (Array.isArray(preRaw)) entry.pre = preRaw as string[];
  if (typeof record.output === "string") entry.output = record.output;

  return entry;
}

export function loadPipelineRegistry(registryPath: string): PipelineRegistry {
  const result: PipelineRegistry = { entries: [], errors: [] };

  let raw: string;
  try {
    raw = fs.readFileSync(registryPath, "utf-8");
  } catch (err) {
    result.errors.push({ reason: `failed to read registry file: ${describeError(err)}` });
    return result;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    result.errors.push({ reason: `registry is not valid JSON: ${describeError(err)}` });
    return result;
  }

  const list = extractEntryList(parsed);
  if (!list) {
    result.errors.push({
      reason: 'registry must be an array of entries or an object with a "skills" array',
    });
    return result;
  }

  const seenIds = new Set<string>();
  list.forEach((item, index) => {
    const validated = validateEntry(item);
    if (typeof validated === "string") {
      result.errors.push({ id: readId(item), reason: `entry ${index}: ${validated}` });
      return;
    }
    if (seenIds.has(validated.id)) {
      result.errors.push({
        id: validated.id,
        reason: `entry ${index}: duplicate skill id '${validated.id}'`,
      });
      return;
    }
    seenIds.add(validated.id);
    result.entries.push(validated);
  });

  return result;
}

async function runEntry(
  entry: PipelineEntry,
  executeTool: (tool: string, params: Record<string, unknown>) => Promise<unknown>,
  resolveEntry: PipelineRunOptions["resolveEntry"],
  memo: Map<string, PipelineRunReport>,
  inFlight: Set<string>,
): Promise<PipelineRunReport> {
  const report: PipelineRunReport = { skillId: entry.id, ok: true, pre: {}, steps: [] };

  inFlight.add(entry.id);
  try {
    for (const preId of entry.pre ?? []) {
      let preReport = memo.get(preId);
      if (!preReport) {
        if (inFlight.has(preId)) {
          throw new Error(`cycle detected in pre-skill chain at '${preId}'`);
        }
        const preEntry = resolveEntry?.(preId);
        if (!preEntry) {
          throw new Error(`pre-skill '${preId}' not found in registry`);
        }
        preReport = await runEntry(preEntry, executeTool, resolveEntry, memo, inFlight);
        memo.set(preId, preReport);
      }
      report.pre[preId] = preReport;
      if (!preReport.ok) {
        throw new Error(`pre-skill '${preId}' failed: ${preReport.error ?? "unknown error"}`);
      }
    }

    for (const step of entry.steps) {
      try {
        const result = await executeTool(step.tool, step.params);
        report.steps.push({ tool: step.tool, status: "ok", result });
      } catch (err) {
        const message = describeError(err);
        report.steps.push({ tool: step.tool, status: "failed", error: message });
        report.ok = false;
        report.error = `step '${step.tool}' failed: ${message}`;
        return report;
      }
    }

    return report;
  } catch (err) {
    report.ok = false;
    report.error = describeError(err);
    return report;
  } finally {
    inFlight.delete(entry.id);
  }
}

export async function runPipeline(
  entry: PipelineEntry,
  executeTool: (tool: string, params: Record<string, unknown>) => Promise<unknown>,
  options?: PipelineRunOptions,
): Promise<PipelineRunReport> {
  const memo = new Map<string, PipelineRunReport>();
  const inFlight = new Set<string>();
  return runEntry(entry, executeTool, options?.resolveEntry, memo, inFlight);
}
