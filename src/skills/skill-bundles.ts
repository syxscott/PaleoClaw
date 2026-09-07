export interface SkillBundle {
  name: string;
  description: string;
  skills: string[];
  instruction?: string;
  source?: string;
  loadedAt?: Date;
}

export interface SkillBundleFile {
  name: string;
  description: string;
  skills: string[];
  instruction?: string;
}

const BUNDLE_CACHE = new Map<string, SkillBundle>();
let BUNDLES_DIR = '';

export function setSkillBundlesDirectory(dir: string): void {
  BUNDLES_DIR = dir;
  BUNDLE_CACHE.clear();
}

export function getSkillBundlesDirectory(): string {
  return BUNDLES_DIR;
}

export async function loadSkillBundle(yamlContent: string, source?: string): Promise<SkillBundle> {
  const bundle: SkillBundleFile = {
    name: '',
    description: '',
    skills: [],
  };

  const lines = yamlContent.split('\n');
  let currentKey = '';
  let blockScalar: { key: string; fold: boolean; indent: number; lines: string[] } | null = null;

  const flushBlockScalar = (): void => {
    if (!blockScalar) return;
    const { key, fold, lines: body } = blockScalar;
    blockScalar = null;

    const indents = body
      .filter((bodyLine) => bodyLine.trim())
      .map((bodyLine) => bodyLine.length - bodyLine.trimStart().length);
    const commonIndent = indents.length > 0 ? Math.min(...indents) : 0;
    const text = body
      .map((bodyLine) => bodyLine.slice(Math.min(commonIndent, bodyLine.length)))
      .join(fold ? ' ' : '\n')
      .trim();

    if (['name', 'description', 'instruction'].includes(key)) {
      (bundle as any)[key] = text;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      // Blank lines inside a block scalar are part of its text.
      if (blockScalar && !trimmed) blockScalar.lines.push('');
      continue;
    }

    // Inside a block scalar (`key: |` / `key: >`): consume more-indented
    // lines as the scalar's text instead of parsing them as keys or lists.
    if (blockScalar) {
      const indent = line.length - line.trimStart().length;
      if (indent > blockScalar.indent) {
        blockScalar.lines.push(line.replace(/\r$/, ''));
        continue;
      }
      flushBlockScalar();
    }

    if (trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':');
      const keyClean = key.trim().toLowerCase();
      const value = valueParts.join(':').trim();

      if (value === '|' || value === '>') {
        blockScalar = {
          key: keyClean,
          fold: value === '>',
          indent: line.length - line.trimStart().length,
          lines: [],
        };
      } else if (['name', 'description', 'instruction'].includes(keyClean)) {
        (bundle as any)[keyClean] = value;
      } else if (keyClean === 'skills') {
        if (value) bundle.skills.push(value);
      }
      currentKey = keyClean;
    } else if (trimmed.startsWith('-')) {
      const skill = trimmed.substring(1).trim();
      // Only `- ` items under the `skills` key are skill names; list items
      // under any other key are ignored.
      if (skill && currentKey === 'skills') bundle.skills.push(skill);
    }
  }
  flushBlockScalar();

  return {
    ...bundle,
    source,
    loadedAt: new Date(),
  };
}

export function getSkillBundles(): SkillBundle[] {
  return Array.from(BUNDLE_CACHE.values());
}

export function getSkillBundle(name: string): SkillBundle | undefined {
  return BUNDLE_CACHE.get(name);
}

export function addSkillBundle(bundle: SkillBundle): void {
  BUNDLE_CACHE.set(bundle.name, bundle);
}

export function removeSkillBundle(name: string): boolean {
  return BUNDLE_CACHE.delete(name);
}

export function buildBundleInvocationMessage(bundle: SkillBundle): string {
  const parts: string[] = [];

  if (bundle.instruction) {
    parts.push(bundle.instruction);
  }

  parts.push(`Using skills: ${bundle.skills.join(', ')}`);

  return parts.join('\n\n');
}

export function reloadBundles(): void {
  BUNDLE_CACHE.clear();
}
