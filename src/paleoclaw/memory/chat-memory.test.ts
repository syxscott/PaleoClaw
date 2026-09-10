import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { TaskMemoryStore, clipText } from './store.js';

let homeDir = '';
const createdDirs: string[] = [];

// Point paleoclawHome() at a throwaway directory (see src/paleoclaw/paths.ts).
beforeEach(() => {
  homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paleoclaw-chat-'));
  createdDirs.push(homeDir);
  process.env.PALEOCLAW_HOME = homeDir;
});

afterAll(() => {
  delete process.env.PALEOCLAW_HOME;
  for (const dir of createdDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function shortDir(): string {
  return path.join(homeDir, 'memory', 'short');
}

function chatFiles(): string[] {
  return fs.readdirSync(shortDir()).filter(f => f.startsWith('chat-'));
}

type ChatDigestRecord = {
  sessionId: unknown;
  day: unknown;
  chat_digest: {
    turn_count: unknown;
    first_turn_at: unknown;
    last_turn_at: unknown;
    recent_turns: Array<{ user?: unknown; ts?: unknown }>;
    intents: unknown[];
    modes: unknown[];
  };
};

function readChatFile(name: string): ChatDigestRecord {
  const parsed: unknown = JSON.parse(fs.readFileSync(path.join(shortDir(), name), 'utf-8'));
  return parsed as ChatDigestRecord;
}

describe('chat daily memory', () => {
  it('folds two turns on the same day into one rolling digest', () => {
    const store = new TaskMemoryStore();
    store.recordChatTurn({
      sessionId: 'sess-a',
      userText: '霸王龙生活在哪个时期?',
      assistantText: '白垩纪晚期。',
      intent: 'fossil-id',
      mode: 'research',
      ts: '2026-09-07T08:00:00Z',
    });
    store.recordChatTurn({
      sessionId: 'sess-a',
      userText: '那棘龙呢?',
      assistantText: '也是白垩纪。',
      ts: '2026-09-07T09:30:00Z',
    });

    expect(chatFiles()).toEqual(['chat-20260907-sess-a.json']);
    const record = readChatFile('chat-20260907-sess-a.json');
    expect(record.sessionId).toBe('sess-a');
    expect(record.day).toBe('20260907');
    expect(record.chat_digest.turn_count).toBe(2);
    expect(record.chat_digest.first_turn_at).toBe('2026-09-07T08:00:00.000Z');
    expect(record.chat_digest.last_turn_at).toBe('2026-09-07T09:30:00.000Z');
    expect(record.chat_digest.recent_turns).toHaveLength(2);
    expect(record.chat_digest.recent_turns[0].user).toBe('霸王龙生活在哪个时期?');
    expect(record.chat_digest.recent_turns[1].ts).toBe('2026-09-07T09:30:00.000Z');
    // Turn 2 omitted intent/mode, so GeoClaw defaults kick in and accumulate.
    expect(record.chat_digest.intents).toEqual(['fossil-id', 'chat']);
    expect(record.chat_digest.modes).toEqual(['research', 'fallback']);
  });

  it('clips recent_turns at 8 and distinct intents at 10', () => {
    const store = new TaskMemoryStore();
    for (let i = 1; i <= 12; i++) {
      store.recordChatTurn({
        sessionId: 'sess-a',
        userText: `u${i}`,
        assistantText: `a${i}`,
        intent: `intent-${i}`,
        ts: `2026-09-07T00:${String(i).padStart(2, '0')}:00Z`,
      });
    }

    const record = readChatFile('chat-20260907-sess-a.json');
    expect(record.chat_digest.turn_count).toBe(12);
    expect(record.chat_digest.recent_turns).toHaveLength(8);
    expect(record.chat_digest.recent_turns[0].user).toBe('u5');
    expect(record.chat_digest.recent_turns[7].user).toBe('u12');
    expect(record.chat_digest.intents).toHaveLength(10);
    expect(record.chat_digest.intents[0]).toBe('intent-3');
    expect(record.chat_digest.intents[9]).toBe('intent-12');
  });

  it('day rollover creates a second day file', () => {
    const store = new TaskMemoryStore();
    store.recordChatTurn({
      sessionId: 'sess-a',
      userText: 'u1',
      assistantText: 'a1',
      ts: '2026-09-07T23:59:00Z',
    });
    store.recordChatTurn({
      sessionId: 'sess-a',
      userText: 'u2',
      assistantText: 'a2',
      ts: '2026-09-08T00:01:00Z',
    });

    expect(chatFiles().toSorted()).toEqual([
      'chat-20260907-sess-a.json',
      'chat-20260908-sess-a.json',
    ]);
    const first = readChatFile('chat-20260907-sess-a.json');
    const second = readChatFile('chat-20260908-sess-a.json');
    expect(first.chat_digest.turn_count).toBe(1);
    expect(second.chat_digest.turn_count).toBe(1);
    expect(second.chat_digest.first_turn_at).toBe('2026-09-08T00:01:00.000Z');
    expect(second.chat_digest.last_turn_at).toBe('2026-09-08T00:01:00.000Z');
  });

  it('sanitizes unsafe session ids in day-file names', () => {
    const store = new TaskMemoryStore();
    store.recordChatTurn({
      sessionId: 'abc/def ghi',
      userText: 'u',
      assistantText: 'a',
      ts: '2026-09-07T08:00:00Z',
    });
    store.recordChatTurn({
      sessionId: '   ',
      userText: 'u',
      assistantText: 'a',
      ts: '2026-09-07T08:00:00Z',
    });
    store.recordChatTurn({
      sessionId: 'x'.repeat(80),
      userText: 'u',
      assistantText: 'a',
      ts: '2026-09-07T08:00:00Z',
    });

    const files = chatFiles();
    expect(files).toContain('chat-20260907-abc_def_ghi.json');
    expect(files).toContain('chat-20260907-adhoc.json');
    expect(files).toContain(`chat-20260907-${'x'.repeat(64)}.json`);
  });

  it('listChatDaily returns day files newest-first and defaults to 7', () => {
    const store = new TaskMemoryStore();
    for (let d = 1; d <= 9; d++) {
      store.recordChatTurn({
        sessionId: 'bench',
        userText: `u${d}`,
        assistantText: 'ok',
        ts: `2026-09-${String(d).padStart(2, '0')}T10:00:00Z`,
      });
    }

    const rows = store.listChatDaily();
    expect(rows).toHaveLength(7);
    expect(rows[0].day).toBe('20260909');
    expect(rows[0].chat_digest.turn_count).toBe(1);
    expect(rows[6].day).toBe('20260903');

    const three = store.listChatDaily(3);
    expect(three.map(r => r.day)).toEqual(['20260909', '20260908', '20260907']);
  });

  it('getChatDailyDigest returns the digest and null for missing or corrupt days', () => {
    const store = new TaskMemoryStore();
    store.recordChatTurn({
      sessionId: 'sess-a',
      userText: 'u',
      assistantText: 'a',
      ts: '2026-09-07T08:00:00Z',
    });

    const digest = store.getChatDailyDigest('20260907');
    expect(digest?.turn_count).toBe(1);
    expect(digest?.last_turn_at).toBe('2026-09-07T08:00:00.000Z');

    expect(store.getChatDailyDigest('20251231')).toBeNull();

    fs.writeFileSync(path.join(shortDir(), 'chat-20251225-broken.json'), '{not json', 'utf-8');
    expect(store.getChatDailyDigest('20251225')).toBeNull();
  });

  it('clipText does not split surrogate pairs at the boundary', () => {
    // 239 BMP chars + one astral emoji = 240 code points but 241 UTF-16 units.
    const atLimit = 'a'.repeat(239) + '🦖';
    expect(atLimit.length).toBe(241);
    expect(clipText(atLimit)).toBe(atLimit);

    // The emoji sits exactly at code point 237, so a code-unit slice(0, 237)
    // would cut it in half.
    const long = 'b'.repeat(236) + '🦖' + 'c'.repeat(30);
    const clipped = clipText(long);
    expect(clipped).toBe(`${'b'.repeat(236)}🦖...`);
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(clipped)).toBe(false);
  });

  it('autoReviewToLong refuses a second promotion of the same task', () => {
    const store = new TaskMemoryStore();
    const taskId = store.startTask('dig', ['--site', 'zhoukoudian'], os.tmpdir());
    store.finishTask(taskId, 0);

    store.autoReviewToLong(taskId);
    expect(store.countLong()).toBe(1);

    expect(() => store.autoReviewToLong(taskId)).toThrow(/has already been promoted/);
    expect(store.countLong()).toBe(1);
  });
});
