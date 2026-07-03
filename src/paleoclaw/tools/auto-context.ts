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

// Common English words that often appear as sentence-initial capitalized words
// but are not taxonomic names. We skip these when scanning for a taxon
// candidate to avoid passing words like "Use", "Find", "Show" to PBDB.
const TAXON_STOPWORDS = new Set([
  'Use', 'Find', 'Show', 'List', 'Get', 'Query', 'Search', 'Look', 'Looks',
  'Check', 'Give', 'Tell', 'What', 'Which', 'Where', 'When', 'Who', 'How',
  'I', 'We', 'You', 'They', 'The', 'This', 'That', 'These', 'Those',
  'A', 'An', 'And', 'Or', 'But', 'For', 'With', 'Without', 'From', 'Into',
  'Can', 'Could', 'Should', 'Would', 'May', 'Might', 'Must', 'Will', 'Shall',
  'Need', 'Want', 'Have', 'Has', 'Had', 'Do', 'Does', 'Did', 'Is', 'Are',
  'Was', 'Were', 'Be', 'Been', 'Being', 'Let', 'Please', 'About', 'Above',
  'After', 'Below', 'Under', 'Over', 'Between', 'Among', 'During', 'Before',
  'Open', 'Close', 'Start', 'Stop', 'Run', 'Build', 'Make', 'Create',
  'Now', 'Then', 'Here', 'There', 'All', 'Any', 'Some', 'No', 'Not',
  'My', 'Your', 'His', 'Her', 'Its', 'Our', 'Their', 'More', 'Most',
  'Other', 'Such', 'Same', 'Own', 'Just', 'Only', 'Also', 'Very', 'Too',
]);

// Geological periods / epochs / eras that should not be treated as taxa even
// though they may be capitalized and have length >= 6.
const GEOLOGICAL_PERIODS = new Set([
  'Cambrian', 'Ordovician', 'Silurian', 'Devonian', 'Carboniferous',
  'Permian', 'Triassic', 'Jurassic', 'Cretaceous',
  'Paleogene', 'Neogene', 'Quaternary',
  'Paleocene', 'Eocene', 'Oligocene', 'Miocene', 'Pliocene',
  'Pleistocene', 'Holocene',
]);

// Common Latin/scientific suffixes for taxa (genera, families, etc.) plus the
// capital-letter-with-2+lowercase minimum length. We require EITHER a
// recognized suffix OR a length >= 6 to accept a candidate, which filters out
// most common English words like "Use" / "Find".
// Only match legitimate multi-character taxonomic suffixes preceded by a stem
// of at least 3 letters. Removed short 1-2 char alternations (us/is/os/a/
// er/ix/um/ia/yx) which caused false positives on common English words.
const TAXON_SUFFIX_RE = /[a-z]{3,}(idae|inae|aceae|opsida|phyta|mycota|formes|oidea|aceae|omorpha)$/i;

function isLikelyTaxon(word: string): boolean {
  if (!word) return false;
  if (TAXON_STOPWORDS.has(word)) return false;
  if (GEOLOGICAL_PERIODS.has(word)) return false;
  if (word.length < 6 && !TAXON_SUFFIX_RE.test(word)) return false;
  return true;
}

const TAXON_NAME_RE = /\b([A-Z][a-z]{2,})\b/g;

function extractTaxonCandidate(text: string): string | undefined {
  const matches = text.matchAll(TAXON_NAME_RE);
  for (const match of matches) {
    const candidate = match[1]?.trim();
    if (candidate && isLikelyTaxon(candidate)) {
      return candidate;
    }
  }
  return undefined;
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
    // Slice at the last whitespace boundary before MAX_QUERY_LEN so we don't
    // break a mid-word, which degrades CrossRef search quality.
    const MAX_QUERY_LEN = 200;
    let query = prompt.slice(0, MAX_QUERY_LEN);
    if (prompt.length > MAX_QUERY_LEN) {
      const lastSpace = query.lastIndexOf(' ');
      if (lastSpace > MAX_QUERY_LEN * 0.5) {
        query = query.slice(0, lastSpace);
      }
    }
    plans.push({
      tool: 'crossref_search',
      params: {
        query: query.trim(),
        rows: 5,
      },
    });
  }

  return plans;
}

function summarizePbdb(data: unknown): string {
  const typed = data as { count?: number; records?: Array<Record<string, unknown> | null> };
  const count = Number(typed?.count || 0);
  // PBDB sometimes returns records entries as null — guard against it before
  // accessing row fields.
  const names = (typed?.records || [])
    .filter((row): row is Record<string, unknown> => row != null)
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

  // Execute all planned tools in parallel — they are independent network calls
  // with no shared state. This caps combined latency at the slowest tool
  // instead of the sum of all tools.
  const results = await Promise.all(
    plans.map(async (plan) => {
      const result = await toolRegistry.execute(plan.tool, plan.params);
      return { plan, result };
    })
  );

  const lines: string[] = [];
  for (const { plan, result } of results) {
    if (!result.ok) continue;
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
