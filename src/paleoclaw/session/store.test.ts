import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_SESSION_TITLE, SessionStore, deriveInstantTitle } from './store.js';

const tempDirs: string[] = [];

function createTempRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paleoclaw-session-test-'));
  tempDirs.push(dir);
  return dir;
}

/** Flush microtasks (e.g. the fire-and-forget titleUpgrader chain). */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('SessionStore', () => {
  it('upserts session with caller-provided id and merges tags', () => {
    const store = new SessionStore(createTempRoot());
    const first = store.upsertSession('external-session-id', 'Seed title', ['seed']);
    expect(first.id).toBe('external-session-id');
    expect(first.title).toBe('Seed title');
    expect(first.titleSource).toBe('user');

    const second = store.upsertSession('external-session-id', 'Updated title', ['new-tag']);
    expect(second.id).toBe('external-session-id');
    expect(second.tags).toContain('seed');
    expect(second.tags).toContain('new-tag');
    // Title is preserved (NOT overwritten) on subsequent upserts to keep
    // session titles stable across multiple agent turns.
    expect(second.title).toBe('Seed title');
  });

  it('preserves a non-empty title on re-upsert (regression #NEW-2)', () => {
    const store = new SessionStore(createTempRoot());
    const first = store.upsertSession('ext-1', 'First prompt title', ['agent:1']);
    expect(first.title).toBe('First prompt title');

    // Caller (e.g. agent command) passes a fresh prompt title on every run.
    const second = store.upsertSession('ext-1', 'Second prompt title', []);
    expect(second.title).toBe('First prompt title');
  });

  it('lets an explicit upsert title replace an auto-derived placeholder', () => {
    const store = new SessionStore(createTempRoot());
    const first = store.upsertSession('ext-derived');
    expect(first.titleSource).toBe('derived');

    const second = store.upsertSession('ext-derived', 'Now Explicit', []);
    expect(second.title).toBe('Now Explicit');
    expect(second.titleSource).toBe('user');

    // ...but never the other way around: user titles are final.
    const third = store.upsertSession('ext-derived', 'Ignored', []);
    expect(third.title).toBe('Now Explicit');
  });

  it('creates, appends, and loads sessions', () => {
    const store = new SessionStore(createTempRoot());
    const session = store.createSession('Jurassic Notes', ['jurassic']);

    store.appendMessage(session.id, 'user', 'Query PBDB for Allosaurus occurrences');
    store.appendMessage(session.id, 'assistant', 'Found 12 records');

    const loaded = store.getSession(session.id);
    expect(loaded.title).toBe('Jurassic Notes');
    expect(loaded.messages).toHaveLength(2);
    expect(loaded.tags).toEqual(['jurassic']);
  });

  it('searches message history by keyword', () => {
    const store = new SessionStore(createTempRoot());
    const session = store.createSession('Cretaceous Workflow');

    store.appendMessage(session.id, 'user', 'Need Cretaceous fossil references with DOI');

    const hits = store.search('cretaceous doi', 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.sessionId).toBe(session.id);
  });
});

describe('deriveInstantTitle (Stage 1)', () => {
  it('takes the first sentence of an English message, keeping the delimiter', () => {
    expect(deriveInstantTitle('Query PBDB for Allosaurus. Also list formations')).toBe(
      'Query PBDB for Allosaurus.'
    );
  });

  it('takes the first sentence of a Chinese message (。！？ delimiters)', () => {
    expect(deriveInstantTitle('帮我查询三角龙的化石记录。顺便列出地层信息')).toBe(
      '帮我查询三角龙的化石记录。'
    );
    expect(deriveInstantTitle('三角龙生活在白垩纪？请确认')).toBe('三角龙生活在白垩纪？');
  });

  it('collapses whitespace before deriving', () => {
    expect(deriveInstantTitle('  multi\nline\tmessage  here. tail')).toBe(
      'multi line message here.'
    );
  });

  it('truncates to ~60 chars without breaking surrogate pairs', () => {
    // 59 ASCII chars + a 2-code-unit emoji spanning the 60-char boundary.
    const message = `${'a'.repeat(59)}😀😀😀 tail text without sentence delimiters`;
    const title = deriveInstantTitle(message);
    expect(title).toBe(`${'a'.repeat(59)}😀...`);
    // 60 code points + '...' and no lone surrogates.
    expect(Array.from(title)).toHaveLength(63);
    expect(title).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it('falls back to the generic default for empty input', () => {
    expect(deriveInstantTitle('')).toBe(DEFAULT_SESSION_TITLE);
    expect(deriveInstantTitle('   ')).toBe(DEFAULT_SESSION_TITLE);
    expect(deriveInstantTitle(undefined)).toBe(DEFAULT_SESSION_TITLE);
  });
});

describe('Session title provenance', () => {
  it('derives a title from the first user message so list never shows Untitled', () => {
    const store = new SessionStore(createTempRoot());
    const session = store.createSession();
    expect(session.title).toBe(DEFAULT_SESSION_TITLE);
    expect(session.titleSource).toBe('derived');

    store.appendMessage(session.id, 'user', '帮我查询三角龙的化石记录。谢谢');

    const loaded = store.getSession(session.id);
    expect(loaded.title).toBe('帮我查询三角龙的化石记录。');
    expect(loaded.titleSource).toBe('derived');
    expect(store.listSessions(20)[0]?.title).toBe('帮我查询三角龙的化石记录。');
  });

  it('never derives or upgrades when the title is user-set', async () => {
    let upgradeCalls = 0;
    const store = new SessionStore(createTempRoot(), {
      titleUpgrader: async () => {
        upgradeCalls += 1;
        return 'LLM Title';
      },
    });
    const session = store.createSession('Manual Title');
    expect(session.titleSource).toBe('user');

    store.appendMessage(session.id, 'user', 'Some first user message. More text');

    await flush();
    const loaded = store.getSession(session.id);
    expect(loaded.title).toBe('Manual Title');
    expect(loaded.titleSource).toBe('user');
    expect(upgradeCalls).toBe(0);
  });

  it('upgrades a derived title via the injected titleUpgrader (Stage 2)', async () => {
    const calls: Array<{ sessionId: string; firstUserMessage: string; currentTitle: string }> = [];
    const store = new SessionStore(createTempRoot(), {
      titleUpgrader: async (input) => {
        calls.push(input);
        return '  A Much Better Title From The LLM  ';
      },
    });
    const session = store.createSession();
    store.appendMessage(session.id, 'user', '帮我查询三角龙的化石记录。补充地层信息');

    // Stage 1 applied synchronously before the upgrade lands.
    const immediate = store.getSession(session.id);
    expect(immediate.title).toBe('帮我查询三角龙的化石记录。');
    expect(immediate.titleSource).toBe('derived');

    await flush();

    const upgraded = store.getSession(session.id);
    expect(upgraded.title).toBe('A Much Better Title From The LLM');
    expect(upgraded.titleSource).toBe('llm');
    expect(calls).toEqual([
      {
        sessionId: session.id,
        firstUserMessage: '帮我查询三角龙的化石记录。补充地层信息',
        currentTitle: '帮我查询三角龙的化石记录。',
      },
    ]);
  });

  it('keeps the derived title when the upgrader returns null or fails', async () => {
    const store = new SessionStore(createTempRoot(), {
      titleUpgrader: async () => {
        throw new Error('LLM unavailable');
      },
    });
    const session = store.createSession();
    store.appendMessage(session.id, 'user', 'First message about ammonites. Tail');

    await flush();
    const loaded = store.getSession(session.id);
    expect(loaded.title).toBe('First message about ammonites.');
    expect(loaded.titleSource).toBe('derived');
  });

  it('backfills titleSource on legacy records missing the field', () => {
    const root = createTempRoot();
    const legacy = (id: string, title: string): string =>
      JSON.stringify({
        id,
        title,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        tags: [],
        messages: [],
      });
    fs.writeFileSync(path.join(root, 'legacy-named.json'), legacy('legacy-named', 'Hand Written'));
    fs.writeFileSync(
      path.join(root, 'legacy-default.json'),
      legacy('legacy-default', DEFAULT_SESSION_TITLE)
    );

    const store = new SessionStore(root);
    expect(store.getSession('legacy-named').titleSource).toBe('user');
    expect(store.getSession('legacy-default').titleSource).toBe('derived');
  });
});
