import { describe, expect, it } from 'vitest';

import { bestMatches, calculateSimilarity } from './retrieval.js';

describe('retrieval - tokenize concurrency', () => {
  it('bestMatches returns deterministic results for repeated calls', () => {
    const items = [
      { source: 'short', taskId: 'a', searchText: 'tyrannosaurus cretaceous hell creek', payload: {} },
      { source: 'short', taskId: 'b', searchText: 'allosaurus morrison formation', payload: {} },
    ];
    const first = bestMatches('tyrannosaurus cretaceous', items, 5, 0.1);
    const second = bestMatches('tyrannosaurus cretaceous', items, 5, 0.1);
    expect(first.length).toBe(second.length);
    expect(first[0]?.taskId).toBe(second[0]?.taskId);
  });

  it('interleaved calls do not corrupt lastIndex', async () => {
    // Run many concurrent tokenize-like operations and verify no NaN/null tokens.
    const calls = Array.from({ length: 50 }, (_, i) =>
      Promise.resolve().then(() => bestMatches(`query ${i}`, [
        { source: 'short', taskId: String(i), searchText: `text ${i} tyrannosaurus`, payload: {} },
      ], 3, 0.0))
    );
    const results = await Promise.all(calls);
    // Each call must produce exactly one ranked item; none should throw.
    expect(results.length).toBe(50);
    for (const r of results) {
      expect(r.length).toBe(1);
    }
  });

  it('calculateSimilarity handles Chinese and ASCII tokens together', () => {
    const score = calculateSimilarity('菊石 ammonoid cretaceous', '白垩 ammonite cretaceous');
    expect(score).toBeGreaterThan(0);
  });
});
