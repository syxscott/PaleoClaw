import { describe, expect, it } from 'vitest';

import { parseSoul, parseUser, splitSections, sectionItems } from './layers.js';

describe('sectionItems / parseSoul mission handling (regression #FEATURE-1)', () => {
  it('captures a leading line that ends with a colon before bullets', () => {
    const md = [
      '## Mission',
      '',
      'Help users conduct reliable, reproducible paleontological research by providing:',
      '- Accurate taxonomic information',
      '- Verified fossil occurrence data',
      '',
    ].join('\n');

    const sections = splitSections(md);
    const items = sectionItems(sections, 'mission');
    // The leading line must be the first item even though it ends with ":".
    expect(items[0]).toBe(
      'Help users conduct reliable, reproducible paleontological research by providing',
    );
    expect(items).toContain('Accurate taxonomic information');
    expect(items).toContain('Verified fossil occurrence data');
  });

  it('parses the default soul template mission correctly', () => {
    const soul = parseSoul([
      '## Identity',
      'PaleoClaw is an AI research assistant.',
      '',
      '## Mission',
      '',
      'Help users conduct reliable, reproducible paleontological research by providing:',
      '- Accurate taxonomic information',
      '- Verified fossil occurrence data',
      '- Peer-reviewed literature references',
      '- Stratigraphic context',
      '- Research synthesis',
      '',
    ].join('\n'));
    expect(soul.mission).toBe(
      'Help users conduct reliable, reproducible paleontological research by providing',
    );
  });

  it('still respects proper key: value pairs (no regression)', () => {
    const user = parseUser([
      '## Identity',
      '',
      'Role: paleontology researcher',
      'Domain: vertebrate paleontology',
      '',
      '## Language Preference',
      '',
      'Preferred language: Chinese or English',
      'Output language: Chinese (simplified)',
      '',
    ].join('\n'));
    expect(user.role).toBe('paleontology researcher');
    expect(user.domain).toBe('vertebrate paleontology');
    expect(user.languagePreference).toBe('Chinese or English');
    expect(user.outputLanguage).toBe('Chinese (simplified)');
  });
});
