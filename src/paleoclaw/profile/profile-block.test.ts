import { describe, expect, it } from 'vitest';

import { buildProfileContextBlock, loadSessionProfile } from './layers.js';

describe('buildProfileContextBlock (NEW-3 integration)', () => {
  it('renders the user profile and system identity for the default templates', () => {
    const profile = loadSessionProfile(process.cwd(), true);
    const block = buildProfileContextBlock(profile);

    // Wrapping fence
    expect(block).toContain('<paleoclaw-profile-context>');
    expect(block).toContain('</paleoclaw-profile-context>');
    // User fields (from DEFAULT_USER_TEMPLATE)
    expect(block).toContain('## User Research Profile');
    expect(block).toContain('Role: paleontology researcher');
    expect(block).toContain('Output language:');
    expect(block).toContain('Citation format:');
    // System fields (from DEFAULT_SOUL_TEMPLATE)
    expect(block).toContain('## Core Principles');
    expect(block).toContain('## Safety Boundaries');
    expect(block).toContain('## In Scope');
    expect(block).toContain('## Out of Scope');
  });

  it('does not throw for an empty/minimal profile', () => {
    const minimal = {
      user: {
        role: 'r', domain: 'd', institution: 'i',
        researchFocus: { primaryInterests: [], preferredPeriods: [], preferredRegions: [] },
        languagePreference: 'en', outputLanguage: 'en',
        communicationStyle: [],
        dataPreferences: { defaultOccurrenceLimit: 50, includePreprints: false, preferOpenAccess: true, citationFormat: 'APA' },
        preferredJournals: [], outputPreferences: [], reproducibilityExpectations: [],
        workflowHabits: [], privacyPreferences: [], longTermConstraints: [],
        collaborationExpectations: [], rawText: '',
      },
      soul: {
        identity: '', mission: '', corePrinciples: [], dataSourceHierarchy: [],
        executionRules: [], scientificCommunicationStandards: [],
        safetyBoundaries: [], collaborationPhilosophy: [],
        domainScope: { inScope: [], outOfScope: [] }, rawText: '',
      },
      soulPath: '/x', userPath: '/y', loadedAt: '',
    };
    const block = buildProfileContextBlock(minimal);
    expect(block).toContain('<paleoclaw-profile-context>');
    expect(block).toContain('Role: r');
  });
});
