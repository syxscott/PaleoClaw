import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { SessionStore } from './store.js';

const tempDirs: string[] = [];

function createTempRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paleoclaw-session-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('SessionStore', () => {
  it('upserts session with caller-provided id', () => {
    const store = new SessionStore(createTempRoot());
    const first = store.upsertSession('external-session-id', 'Seed title', ['seed']);
    expect(first.id).toBe('external-session-id');
    expect(first.title).toBe('Seed title');

    const second = store.upsertSession('external-session-id', 'Updated title', ['new-tag']);
    expect(second.id).toBe('external-session-id');
    expect(second.tags).toContain('seed');
    expect(second.tags).toContain('new-tag');
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
