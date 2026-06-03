import { describe, expect, it } from 'vitest';

import { resolveAutoToolPlan } from './auto-context.js';

describe('resolveAutoToolPlan - taxon extraction', () => {
  it('returns empty plan for generic chat', () => {
    const plans = resolveAutoToolPlan('Hello, how are you today?');
    expect(plans).toHaveLength(0);
  });

  it('skips the leading verb "Use" and extracts the actual taxon', () => {
    const plans = resolveAutoToolPlan('Use PBDB to find Allosaurus occurrences in Morrison Formation');
    expect(plans.some((item) => item.tool === 'pbdb_query')).toBe(true);
    const pbdb = plans.find((p) => p.tool === 'pbdb_query');
    // Bug fix: previously this was 'Use'; now it should be 'Allosaurus'.
    expect((pbdb?.params as { baseName?: string }).baseName).toBe('Allosaurus');
  });

  it('skips the leading verb "Find" and extracts the taxon', () => {
    const plans = resolveAutoToolPlan('Find fossil occurrences for Tyrannosaurus in North America');
    const pbdb = plans.find((p) => p.tool === 'pbdb_query');
    expect((pbdb?.params as { baseName?: string }).baseName).toBe('Tyrannosaurus');
  });

  it('returns undefined baseName when no plausible taxon can be found', () => {
    const plans = resolveAutoToolPlan('Query PBDB for everything about fossils');
    const pbdb = plans.find((p) => p.tool === 'pbdb_query');
    // "everything" is not a taxon, "fossils" is not a taxon, "about" is in stopwords
    expect((pbdb?.params as { baseName?: string }).baseName).toBeUndefined();
  });

  it('returns CrossRef plan for literature prompts', () => {
    const plans = resolveAutoToolPlan('Find DOI and citation metadata for Jurassic theropod papers via CrossRef');
    expect(plans.some((item) => item.tool === 'crossref_search')).toBe(true);
  });

  it('does not treat geological periods as taxa', () => {
    const plans = resolveAutoToolPlan('Find all fossils in the Cretaceous');
    const pbdb = plans.find((p) => p.tool === 'pbdb_query');
    expect((pbdb?.params as { baseName?: string }).baseName).toBeUndefined();
  });

  it('still extracts higher-order taxa like Ammonoidea', () => {
    const plans = resolveAutoToolPlan('Find Ammonoidea in Jurassic');
    const pbdb = plans.find((p) => p.tool === 'pbdb_query');
    expect((pbdb?.params as { baseName?: string }).baseName).toBe('Ammonoidea');
  });
});
