/**
 * PaleoClaw Profile Layers - Soul/User 双层个性化架构
 * Adapted from GeoClaw-OpenAI v2.4.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { paleoclawHome } from '../paths';

// Default templates
export const DEFAULT_SOUL_TEMPLATE = `# PaleoClaw Soul

## Identity
PaleoClaw is an AI research assistant specialized in paleontology and geosciences.

PaleoClaw is NOT a general-purpose assistant. It is a domain-specific scientific workflow system that combines natural language understanding with verified paleontological data sources.

## Mission
Help users conduct reliable, reproducible paleontological research by providing:
- Accurate taxonomic information
- Verified fossil occurrence data
- Peer-reviewed literature references
- Stratigraphic context
- Research synthesis

## Core Principles
1. Scientific Integrity: Never fabricate data, taxa, or papers
2. Verifiability: All claims must be traceable to primary sources
3. Transparency: Clearly state data sources and uncertainties
4. Reproducibility: Document all queries and parameters
5. Humility: Acknowledge limits of current knowledge

## Data Source Hierarchy
1. Paleobiology Database (PBDB) - primary fossil data
2. CrossRef - peer-reviewed literature metadata
3. Semantic Scholar - citation analysis
4. arXiv - preprints (clearly marked as non-peer-reviewed)
5. NCBI Taxonomy - auxiliary taxonomic data
6. Wikidata - cross-reference only, never primary source

## Execution Rules
1. Always verify taxonomic names via PBDB before use
2. Always include DOI for paper citations
3. Always report age ranges with uncertainty (in Ma)
4. Always distinguish fact from hypothesis
5. Always note when data is incomplete or disputed

## Scientific Communication Standards
- Use formal taxonomic nomenclature (italicized genus/species)
- Report geological ages in Ma (Mega-annum)
- Include period/epoch names (e.g., "Early Cretaceous")
- Cite sources explicitly (Author et al., Year, DOI)
- Note sampling biases and limitations

## Safety Boundaries
PaleoClaw MUST NOT:
- Fabricate species names or fossil occurrences
- Invent paper citations or DOIs
- Claim certainty where none exists
- Access paywalled content through unauthorized means
- Provide identification services for commercial fossil trading
- Replace peer review or expert consultation

## Collaboration Philosophy
PaleoClaw acts as a research assistant, not an authority:
- Assist reasoning rather than replace expert judgement
- Document all analytical steps
- Help users understand evidence quality
- Suggest appropriate verification methods
- Encourage consultation of primary sources

## Domain Scope
### In Scope:
- Paleontology (all periods, all taxa)
- Stratigraphy and geological time
- Taxonomy and systematics
- Paleobiology and paleoecology
- Taphonomy and fossil preservation
- Scientific literature analysis

### Out of Scope:
- Modern organism identification
- Commercial fossil appraisal
- Geological resource exploration
- Archaeological artifact analysis
- Creation science or pseudoscience
`;

export const DEFAULT_USER_TEMPLATE = `# PaleoClaw User Profile

## Identity
Role: paleontology researcher
Domain: vertebrate paleontology, dinosaur systematics
Institution: China University of Geosciences (Wuhan)

## Research Focus
### Primary interests:
- Theropod dinosaurs
- Jurassic stratigraphy
- Chinese formations (Yixian, Jiufotang, Shishugou)
- Dinosaur ontogeny and growth
- Paleoecology and paleoenvironment

### Preferred geological periods:
- Jurassic
- Cretaceous

### Preferred regions:
- China (Liaoning, Xinjiang, Sichuan, Yunnan)
- Mongolia
- North America (Hell Creek, Morrison)

## Language Preference
Preferred language: Chinese or English
Output language: Chinese (simplified)

## Communication Style
- Structured scientific responses
- Formal taxonomic nomenclature
- Concise summaries with detailed appendices
- Step-by-step workflow documentation

## Data Preferences
Default occurrence limit: 50
Include preprints: false
Prefer open access: true
Citation format: APA

## Preferred Journals
- Paleobiology
- Cretaceous Research
- Journal of Vertebrate Paleontology
- Nature Communications
- Science Bulletin
- Geological Society of America Bulletin
- Palaeogeography, Palaeoclimatology, Palaeoecology

## Output Preferences
- Markdown reports
- Structured bibliographies with DOIs
- Chronological data tables
- Geographic distribution summaries
- Reproducible workflow documentation

## Reproducibility Expectations
- Document all query parameters
- Save intermediate results
- Version control research workflows
- Explicit data source citations
- Method transparency

## Workflow Habits
- Prefer incremental literature reviews
- Prioritize PBDB-verified taxonomic data
- Cross-reference multiple data sources
- Maintain research notes in Obsidian
- Regular data backup
- Weekly research summaries

## Privacy and Safety
- Store research data locally
- Never expose API keys in outputs
- Respect data provider terms of service
- Secure backup of sensitive research data

## Long-term Constraints and Habits
- Prefer open-access publications when available
- Prioritize Chinese fossil localities
- Focus on well-preserved specimens
- Emphasize quantitative analyses
- Maintain collaboration network

## Collaboration Expectations
- Share reproducible workflows
- Credit data sources appropriately
- Respect peer review confidentiality
- Contribute to community databases (PBDB)

*Profile created for PaleoClaw v1.6.0*
*Customize this file to match your research preferences*
`;

// Interfaces
export interface SoulConfig {
  identity: string;
  mission: string;
  corePrinciples: string[];
  dataSourceHierarchy: string[];
  executionRules: string[];
  scientificCommunicationStandards: string[];
  safetyBoundaries: string[];
  collaborationPhilosophy: string[];
  domainScope: {
    inScope: string[];
    outOfScope: string[];
  };
  rawText: string;
}

export interface UserProfile {
  role: string;
  domain: string;
  institution: string;
  researchFocus: {
    primaryInterests: string[];
    preferredPeriods: string[];
    preferredRegions: string[];
  };
  languagePreference: string;
  outputLanguage: string;
  communicationStyle: string[];
  dataPreferences: {
    defaultOccurrenceLimit: number;
    includePreprints: boolean;
    preferOpenAccess: boolean;
    citationFormat: string;
  };
  preferredJournals: string[];
  outputPreferences: string[];
  reproducibilityExpectations: string[];
  workflowHabits: string[];
  privacyPreferences: string[];
  longTermConstraints: string[];
  collaborationExpectations: string[];
  rawText: string;
}

export interface SessionProfile {
  soul: SoulConfig;
  user: UserProfile;
  soulPath: string;
  userPath: string;
  loadedAt: string;
}

// Helper functions
function readTextOrDefault(filePath: string, fallback: string): string {
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch {
    // Ignore errors
  }
  return fallback;
}

function writeDefaultIfMissing(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    return;
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content.trim() + '\n', 'utf-8');
}

function splitSections(markdown: string): Record<string, string> {
  const sections: Record<string, string[]> = {};
  const headerRegex = /^#{2,3}\s+(.+?)\s*$/;

  const lines = markdown.split('\n');
  let current = '';

  for (const line of lines) {
    const match = line.match(headerRegex);
    if (match) {
      // Strip trailing punctuation like ":" so lookups like 'primary interests'
      // (without the colon) work for headings such as '### Primary interests:'.
      current = match[1].trim().toLowerCase().replace(/[:\s]+$/, '');
      sections[current] = [];
      continue;
    }
    if (current) {
      sections[current].push(line);
    }
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(sections)) {
    result[key] = value.join('\n').trim();
  }
  return result;
}

function sectionText(sections: Record<string, string>, ...aliases: string[]): string {
  for (const key of aliases) {
    const text = sections[key.toLowerCase()];
    if (text) return text;
  }
  return '';
}

function sectionItems(sections: Record<string, string>, ...aliases: string[]): string[] {
  const text = sectionText(sections, ...aliases);
  if (!text) return [];

  const items: string[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip markdown horizontal rules ("---", "***", "___") that some templates
    // use between sections; they are not user-visible content.
    if (/^[-*_]{3,}$/.test(trimmed)) {
      continue;
    }

    // Match bullet points
    const bulletMatch = trimmed.match(/^(?:[-*]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      items.push(bulletMatch[1].trim());
      continue;
    }

    // Match key: value format. Lines that LOOK like "key: value" with a
    // non-empty value are captured as the value. Lines that end with a
    // colon (no value, e.g. "Mission: provide the following:") fall through
    // to plain-text handling so the leading text isn't silently dropped.
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      if (parts.length >= 2) {
        const value = parts.slice(1).join(':').trim();
        if (value) {
          items.push(value);
          continue;
        }
      }
    }

    // Plain text lines — accept any non-empty line (length > 0, not > 2
    // which silently dropped valid short values like "Yes", "50", "N/A").
    if (trimmed.length > 0) {
      items.push(trimmed);
    }
  }

  // Deduplicate while preserving order
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = item.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  
  return unique;
}

function extractKv(text: string, key: string, defaultValue = ''): string {
  const pattern = new RegExp(`^${key}\\s*:\\s*(.+)$`, 'im');
  const match = text.match(pattern);
  return match ? match[1].trim() : defaultValue;
}

function parseSoul(markdown: string): SoulConfig {
  const sections = splitSections(markdown);

  const identity = sectionText(sections, 'identity');
  const missionRaw = sectionText(sections, 'mission');
  const missionItems = sectionItems(sections, 'mission');
  const mission = missionItems[0] || (missionRaw ? missionRaw.split('\n')[0].trim() : '');

  const corePrinciples = sectionItems(sections, 'core principles');
  const dataSourceHierarchy = sectionItems(sections, 'data source hierarchy');
  const executionRules = sectionItems(sections, 'execution rules');
  const scientificCommunicationStandards = sectionItems(sections, 'scientific communication standards');
  // Safety boundaries may live under '## Safety Boundaries' directly or in a
  // '### PaleoClaw MUST NOT:' subsection; fall back to the latter.
  const safetyBoundaries =
    sectionItems(sections, 'safety boundaries').length > 0
      ? sectionItems(sections, 'safety boundaries')
      : sectionItems(sections, 'paleoclaw must not');
  const collaborationPhilosophy = sectionItems(sections, 'collaboration philosophy');

  // Parse domain scope. With the colon-stripping fix in splitSections(), the
  // '### In Scope:' and '### Out of Scope:' headings become their own section
  // keys ('in scope', 'out of scope') instead of being embedded in 'domain scope'.
  const parseBulletList = (text: string): string[] =>
    text
      .split('\n')
      .map((line) => line.trim())
      // Skip markdown horizontal rules ("---", "***", "___") which can sneak
      // in between sections in some templates.
      .filter((line) => !/^[-*_]{3,}$/.test(line))
      .filter((line) => line.startsWith('-') || line.startsWith('*'))
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);

  const inScope = parseBulletList(sectionText(sections, 'in scope'));
  const outOfScope = parseBulletList(sectionText(sections, 'out of scope'));

  return {
    identity,
    mission,
    corePrinciples,
    dataSourceHierarchy,
    executionRules,
    scientificCommunicationStandards,
    safetyBoundaries,
    collaborationPhilosophy,
    domainScope: { inScope, outOfScope },
    rawText: markdown,
  };
}

function parseUser(markdown: string): UserProfile {
  const sections = splitSections(markdown);
  
  const identity = sectionText(sections, 'identity');
  const role = extractKv(identity, 'Role', 'paleontology researcher');
  const domain = extractKv(identity, 'Domain', 'vertebrate paleontology');
  const institution = extractKv(identity, 'Institution', '');
  
  // Research focus
  const researchFocusText = sectionText(sections, 'research focus');
  const primaryInterests = sectionItems(sections, 'primary interests');
  const preferredPeriods = sectionItems(sections, 'preferred periods');
  const preferredRegions = sectionItems(sections, 'preferred regions');
  
  // Language
  const langPref = sectionText(sections, 'language preference');
  const languagePreference = extractKv(langPref, 'Preferred language', 'Chinese or English');
  const outputLanguage = extractKv(langPref, 'Output language', 'Chinese');
  
  // Communication style
  const communicationStyle = sectionItems(sections, 'communication style');
  
  // Data preferences
  const dataPrefText = sectionText(sections, 'data preferences');
  const defaultOccurrenceLimit = parseInt(extractKv(dataPrefText, 'Default occurrence limit', '50')) || 50;
  const includePreprints = extractKv(dataPrefText, 'Include preprints', 'false').toLowerCase() === 'true';
  const preferOpenAccess = extractKv(dataPrefText, 'Prefer open access', 'true').toLowerCase() === 'true';
  const citationFormat = extractKv(dataPrefText, 'Citation format', 'APA');
  
  // Other preferences
  const preferredJournals = sectionItems(sections, 'preferred journals');
  const outputPreferences = sectionItems(sections, 'output preferences');
  const reproducibilityExpectations = sectionItems(sections, 'reproducibility expectations');
  const workflowHabits = sectionItems(sections, 'workflow habits');
  const privacyPreferences = sectionItems(sections, 'privacy and safety');
  const longTermConstraints = sectionItems(sections, 'long-term constraints and habits');
  const collaborationExpectations = sectionItems(sections, 'collaboration expectations');

  return {
    role,
    domain,
    institution,
    researchFocus: {
      primaryInterests,
      preferredPeriods,
      preferredRegions,
    },
    languagePreference,
    outputLanguage,
    communicationStyle,
    dataPreferences: {
      defaultOccurrenceLimit,
      includePreprints,
      preferOpenAccess,
      citationFormat,
    },
    preferredJournals,
    outputPreferences,
    reproducibilityExpectations,
    workflowHabits,
    privacyPreferences,
    longTermConstraints,
    collaborationExpectations,
    rawText: markdown,
  };
}

// Profile cache keyed by workspace root so multi-workspace usage returns the
// correct profile for each workspaceRoot.
const _PROFILE_CACHE_MAP = new Map<string, SessionProfile>();

export function ensureProfileLayers(workspaceRoot?: string): Record<string, string> {
  const root = workspaceRoot ? path.resolve(workspaceRoot) : process.cwd();
  const home = paleoclawHome();
  
  if (!fs.existsSync(home)) {
    fs.mkdirSync(home, { recursive: true });
  }
  
  const workspaceSoul = path.join(root, 'soul.md');
  const workspaceUser = path.join(root, 'user.md');
  const homeSoul = path.join(home, 'soul.md');
  const homeUser = path.join(home, 'user.md');
  
  const soulSeed = readTextOrDefault(workspaceSoul, DEFAULT_SOUL_TEMPLATE);
  const userSeed = readTextOrDefault(workspaceUser, DEFAULT_USER_TEMPLATE);
  
  writeDefaultIfMissing(homeSoul, soulSeed);
  writeDefaultIfMissing(homeUser, userSeed);
  
  return {
    workspaceRoot: root,
    workspaceSoul,
    workspaceUser,
    homeSoul,
    homeUser,
  };
}

function resolveLayerPath(envKey: string, preferredPaths: string[]): string {
  const envValue = process.env[envKey]?.trim();
  if (envValue) {
    const envPath = path.resolve(envValue);
    if (fs.existsSync(envPath) && fs.statSync(envPath).isFile()) {
      return envPath;
    }
  }
  
  for (const p of preferredPaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return path.resolve(p);
    }
  }
  
  return preferredPaths[0];
}

export function loadSessionProfile(workspaceRoot?: string, forceReload = false): SessionProfile {
  const root = workspaceRoot ? path.resolve(workspaceRoot) : process.cwd();

  if (_PROFILE_CACHE_MAP.has(root) && !forceReload) {
    return _PROFILE_CACHE_MAP.get(root)!;
  }

  const ensured = ensureProfileLayers(root);
  
  const soulPath = resolveLayerPath('PALEOCLAW_SOUL_PATH', [
    ensured.homeSoul,
    ensured.workspaceSoul,
  ]);
  
  const userPath = resolveLayerPath('PALEOCLAW_USER_PATH', [
    ensured.homeUser,
    ensured.workspaceUser,
  ]);
  
  const soulText = readTextOrDefault(soulPath, DEFAULT_SOUL_TEMPLATE);
  const userText = readTextOrDefault(userPath, DEFAULT_USER_TEMPLATE);
  
  const profile: SessionProfile = {
    soul: parseSoul(soulText),
    user: parseUser(userText),
    soulPath,
    userPath,
    loadedAt: new Date().toISOString(),
  };
  
  _PROFILE_CACHE_MAP.set(root, profile);
  return profile;
}

export function clearProfileCache(workspaceRoot?: string): void {
  if (workspaceRoot) {
    _PROFILE_CACHE_MAP.delete(path.resolve(workspaceRoot));
  } else {
    _PROFILE_CACHE_MAP.clear();
  }
}

export function getProfileCache(workspaceRoot?: string): SessionProfile | null {
  if (workspaceRoot) {
    return _PROFILE_CACHE_MAP.get(path.resolve(workspaceRoot)) ?? null;
  }
  // Return the first cached entry when no specific root is requested (legacy behavior).
  return _PROFILE_CACHE_MAP.values().next().value ?? null;
}

// Context builders for different modules
export function plannerContext(profile: SessionProfile): Record<string, unknown> {
  return {
    preferredLanguage: profile.user.languagePreference,
    outputLanguage: profile.user.outputLanguage,
    researchFocus: profile.user.researchFocus,
    corePrinciples: profile.soul.corePrinciples,
    dataSourceHierarchy: profile.soul.dataSourceHierarchy,
    executionRules: profile.soul.executionRules,
  };
}

export function toolRouterContext(profile: SessionProfile): Record<string, unknown> {
  return {
    dataSourceHierarchy: profile.soul.dataSourceHierarchy,
    safetyBoundaries: profile.soul.safetyBoundaries,
    preferredJournals: profile.user.preferredJournals,
    domainScope: profile.soul.domainScope,
  };
}

export function reportContext(profile: SessionProfile): Record<string, unknown> {
  return {
    mission: profile.soul.mission,
    scientificCommunicationStandards: profile.soul.scientificCommunicationStandards,
    outputPreferences: profile.user.outputPreferences,
    citationFormat: profile.user.dataPreferences.citationFormat,
  };
}

export function memoryContext(profile: SessionProfile): Record<string, unknown> {
  return {
    userRole: profile.user.role,
    researchFocus: profile.user.researchFocus,
    reproducibilityExpectations: profile.user.reproducibilityExpectations,
    workflowHabits: profile.user.workflowHabits,
    longTermConstraints: profile.user.longTermConstraints,
    truthfulnessRules: profile.soul.corePrinciples,
    preferredTone: profile.user.communicationStyle.join(', '),
  };
}

/**
 * Render a fenced profile context block that is prepended to the agent prompt.
 * The block is plain-text Markdown so the LLM can follow the bullet structure,
 * and it is wrapped in <paleoclaw-profile-context> tags so downstream tools
 * (e.g. memory sanitizers) can recognize and strip it if needed.
 */
export function buildProfileContextBlock(profile: SessionProfile): string {
  const lines: string[] = [];
  const user = profile.user;
  const soul = profile.soul;

  lines.push('## User Research Profile');
  lines.push(`- Role: ${user.role}`);
  if (user.domain) lines.push(`- Domain: ${user.domain}`);
  if (user.institution) lines.push(`- Institution: ${user.institution}`);
  if (user.researchFocus.primaryInterests.length > 0) {
    lines.push(`- Primary interests: ${user.researchFocus.primaryInterests.join(', ')}`);
  }
  if (user.researchFocus.preferredPeriods.length > 0) {
    lines.push(`- Preferred periods: ${user.researchFocus.preferredPeriods.join(', ')}`);
  }
  if (user.researchFocus.preferredRegions.length > 0) {
    lines.push(`- Preferred regions: ${user.researchFocus.preferredRegions.join(', ')}`);
  }
  lines.push(`- Preferred language: ${user.languagePreference}`);
  lines.push(`- Output language: ${user.outputLanguage}`);
  if (user.communicationStyle.length > 0) {
    lines.push(`- Communication style: ${user.communicationStyle.join(', ')}`);
  }
  lines.push(`- Citation format: ${user.dataPreferences.citationFormat}`);
  lines.push(`- Default occurrence limit: ${user.dataPreferences.defaultOccurrenceLimit}`);
  lines.push(`- Prefer open access: ${user.dataPreferences.preferOpenAccess ? 'yes' : 'no'}`);
  lines.push(`- Include preprints: ${user.dataPreferences.includePreprints ? 'yes' : 'no'}`);

  if (soul.identity && soul.identity.trim()) {
    lines.push('');
    lines.push('## System Identity');
    lines.push(soul.identity.trim());
  }
  if (soul.mission && soul.mission.trim()) {
    lines.push('');
    lines.push('## Mission');
    lines.push(soul.mission.trim());
  }
  if (soul.corePrinciples.length > 0) {
    lines.push('');
    lines.push('## Core Principles');
    for (const item of soul.corePrinciples) lines.push(`- ${item}`);
  }
  if (soul.executionRules.length > 0) {
    lines.push('');
    lines.push('## Execution Rules');
    for (const item of soul.executionRules) lines.push(`- ${item}`);
  }
  if (soul.safetyBoundaries.length > 0) {
    lines.push('');
    lines.push('## Safety Boundaries');
    for (const item of soul.safetyBoundaries) lines.push(`- ${item}`);
  }
  if (soul.domainScope.inScope.length > 0) {
    lines.push('');
    lines.push('## In Scope');
    for (const item of soul.domainScope.inScope) lines.push(`- ${item}`);
  }
  if (soul.domainScope.outOfScope.length > 0) {
    lines.push('');
    lines.push('## Out of Scope');
    for (const item of soul.domainScope.outOfScope) lines.push(`- ${item}`);
  }

  const body = lines.join('\n').trim();
  if (!body) return '';

  return [
    '<paleoclaw-profile-context>',
    '[System note: The following is the user research profile and PaleoClaw system identity. Treat as authoritative background — follow the execution rules and respect the safety boundaries. The user has customized these files in ~/.paleoclaw/soul.md and ~/.paleoclaw/user.md.]',
    '',
    body,
    '</paleoclaw-profile-context>',
  ].join('\n');
}
