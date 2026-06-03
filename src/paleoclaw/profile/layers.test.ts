import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SOUL_TEMPLATE,
  DEFAULT_USER_TEMPLATE,
  memoryContext,
  plannerContext,
  reportContext,
  toolRouterContext,
  loadSessionProfile,
  clearProfileCache,
} from './layers.js';

describe('profile layers parsing', () => {
  it('parses colon-suffixed subheadings in the default user template', () => {
    clearProfileCache();
    delete process.env.PALEOCLAW_USER_PATH;
    delete process.env.PALEOCLAW_SOUL_PATH;

    const profile = loadSessionProfile(process.cwd(), true);

    // After colon-stripping fix, these arrays should be populated from
    // ### Primary interests: / ### Preferred geological periods: / etc.
    expect(profile.user.researchFocus.primaryInterests.length).toBeGreaterThan(0);
    expect(profile.user.researchFocus.preferredPeriods.length).toBeGreaterThan(0);
    expect(profile.user.researchFocus.preferredRegions.length).toBeGreaterThan(0);
  });

  it('parses colon-suffixed subheadings in the default soul template', () => {
    clearProfileCache();
    const profile = loadSessionProfile(process.cwd(), true);

    // In Scope / Out of Scope should now be populated correctly.
    expect(profile.soul.domainScope.inScope.length).toBeGreaterThan(0);
    expect(profile.soul.domainScope.outOfScope.length).toBeGreaterThan(0);
  });

  it('default templates are well-formed markdown', () => {
    expect(DEFAULT_SOUL_TEMPLATE).toContain('## Identity');
    expect(DEFAULT_SOUL_TEMPLATE).toContain('## Domain Scope');
    expect(DEFAULT_SOUL_TEMPLATE).toContain('### In Scope:');
    expect(DEFAULT_USER_TEMPLATE).toContain('## Identity');
    expect(DEFAULT_USER_TEMPLATE).toContain('## Research Focus');
    expect(DEFAULT_USER_TEMPLATE).toContain('### Primary interests:');
  });
});

describe('profile context builders', () => {
  const buildProfile = () => {
    clearProfileCache();
    delete process.env.PALEOCLAW_USER_PATH;
    delete process.env.PALEOCLAW_SOUL_PATH;
    return loadSessionProfile(process.cwd(), true);
  };

  it('memoryContext returns longTermConstraints (not reproducibilityExpectations)', () => {
    const profile = buildProfile();
    const ctx = memoryContext(profile);
    // Bug fix: both keys used to be reproducibilityExpectations.
    expect(ctx.longTermConstraints).toBe(profile.user.longTermConstraints);
    expect(ctx.reproducibilityExpectations).toBe(profile.user.reproducibilityExpectations);
  });

  it('plannerContext exposes the expected research focus', () => {
    const profile = buildProfile();
    const ctx = plannerContext(profile);
    expect(ctx.preferredLanguage).toBe(profile.user.languagePreference);
    expect(ctx.researchFocus).toEqual(profile.user.researchFocus);
  });

  it('toolRouterContext exposes safety boundaries and preferred journals', () => {
    const profile = buildProfile();
    const ctx = toolRouterContext(profile);
    expect(ctx.preferredJournals).toBe(profile.user.preferredJournals);
  });

  it('reportContext exposes mission and citation format', () => {
    const profile = buildProfile();
    const ctx = reportContext(profile);
    expect(ctx.citationFormat).toBe(profile.user.dataPreferences.citationFormat);
  });
});
