/**
 * Lightweight pre-run auto tool context injector.
 * Runs selected PaleoClaw tools before the main LLM run and injects compact facts.
 */

import { loadBuiltinTools } from './loader.js';
import { toolRegistry } from './registry.js';

export type AutoToolPlan = {
  tool: 'pbdb_query' | 'crossref_search';
  params: Record<string, unknown>;
};

const TAXON_NAME_RE = /\b([A-Z][a-z]{2,}(?:\s+[a-z]{2,})?)\b/;

function extractTaxonCandidate(text: string): string | undefined {
  const match = text.match(TAXON_NAME_RE);
  if (!match) {
    return undefined;
  }
  return match[1]?.trim();
}

export function resolveAutoToolPlan(prompt: string): AutoToolPlan[] {
  const normalized = prompt.toLowerCase();
  const plans: AutoToolPlan[] = [];

  const asksPbdb = /\b(pbdb|fossil|occurrence|taxon|stratigraph|formation)\b/.test(normalized);
  const asksLiterature = /\b(crossref|doi|citation|paper|literature|journal|references?)\b/.test(
    normalized
  );

  if (asksPbdb) {
    const taxon = extractTaxonCandidate(prompt);
    plans.push({
      tool: 'pbdb_query',
      params: {
        baseName: taxon,
        limit: 5,
      },
    });
  }

  if (asksLiterature) {
    plans.push({
      tool: 'crossref_search',
      params: {
        query: prompt.slice(0, 200),
        rows: 5,
      },
    });
  }

  return plans;
}

function summarizePbdb(data: unknown): string {
  const typed = data as { count?: number; records?: Array<Record<string, unknown>> };
  const count = Number(typed?.count || 0);
  const names = (typed?.records || [])
    .slice(0, 3)
    .map((row) => String(row.tna || row.taxon_name || '').trim())
    .filter(Boolean);

  return `PBDB hits=${count}${names.length > 0 ? `; taxa=${names.join(', ')}` : ''}`;
}

function summarizeCrossref(data: unknown): string {
  const typed = data as { totalResults?: number; items?: Array<Record<string, unknown>> };
  const total = Number(typed?.totalResults || 0);
  const dois = (typed?.items || [])
    .slice(0, 3)
    .map((item) => {
      const doi = item.DOI;
      return typeof doi === 'string' ? doi : '';
    })
    .filter(Boolean);

  return `CrossRef total=${total}${dois.length > 0 ? `; dois=${dois.join(', ')}` : ''}`;
}

function summarizeResult(toolName: string, data: unknown): string {
  if (toolName === 'pbdb_query') {
    return summarizePbdb(data);
  }
  if (toolName === 'crossref_search') {
    return summarizeCrossref(data);
  }
  return `${toolName}: result ready`;
}

export async function buildAutoToolsContext(prompt: string): Promise<string> {
  const plans = resolveAutoToolPlan(prompt);
  if (plans.length === 0) {
    return '';
  }

  await loadBuiltinTools();

  const lines: string[] = [];
  for (const plan of plans) {
    const result = await toolRegistry.execute(plan.tool, plan.params);
    if (!result.ok) {
      continue;
    }
    lines.push(summarizeResult(plan.tool, result.data));
  }

  if (lines.length === 0) {
    return '';
  }

  return [
    '<paleoclaw-tools-context>',
    '[System note: Auto-fetched structured context from PaleoClaw tools.]',
    ...lines.map((line) => `- ${line}`),
    '</paleoclaw-tools-context>',
  ].join('\n');
}
