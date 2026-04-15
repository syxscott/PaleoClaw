import { describe, expect, it } from 'vitest';

import { resolveAutoToolPlan } from './auto-context.js';

describe('resolveAutoToolPlan', () => {
  it('returns PBDB plan for fossil/taxon prompts', () => {
    const plans = resolveAutoToolPlan('Use PBDB to find Allosaurus occurrences in Morrison Formation');
    expect(plans.some((item) => item.tool === 'pbdb_query')).toBe(true);
  });

  it('returns CrossRef plan for literature prompts', () => {
    const plans = resolveAutoToolPlan('Find DOI and citation metadata for Jurassic theropod papers via CrossRef');
    expect(plans.some((item) => item.tool === 'crossref_search')).toBe(true);
  });

  it('returns empty plan for generic chat', () => {
    const plans = resolveAutoToolPlan('Hello, how are you today?');
    expect(plans).toHaveLength(0);
  });
});
