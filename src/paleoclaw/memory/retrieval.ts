/**
 * PaleoClaw Memory Retrieval - Vector-based similarity search
 * Adapted from GeoClaw-OpenAI v2.4.0
 */

const TOKEN_PATTERN = '[A-Za-z0-9_]+|[\\u4e00-\\u9fff]';

export interface SearchItem {
  source: string;
  taskId: string;
  searchText: string;
  payload: Record<string, unknown>;
  score?: number;
}

export interface RankedItem extends SearchItem {
  score: number;
}

// LRU cache for tokenized vectors so repeated queries don't re-hash.
const VECTOR_CACHE_MAX = 500;
const vectorCache = new Map<string, Map<number, number>>();
function getCachedVector(text: string, dim: number): Map<number, number> {
  const cached = vectorCache.get(text);
  if (cached) return cached;
  const vec = textToVector(text, dim);
  if (vectorCache.size >= VECTOR_CACHE_MAX) {
    // Evict oldest entry (Map preserves insertion order).
    const firstKey = vectorCache.keys().next().value;
    if (firstKey !== undefined) vectorCache.delete(firstKey);
  }
  vectorCache.set(text, vec);
  return vec;
}

function tokenize(text: string): string[] {
  // Create a fresh global regex per call to avoid shared `lastIndex` state
  // that would cause race conditions under concurrent tokenize() invocations.
  const re = new RegExp(TOKEN_PATTERN, 'g');
  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    tokens.push(match[0].toLowerCase());
  }
  return tokens;
}

/**
 * FNV-1a 32-bit hash — fast, non-cryptographic, no string allocation.
 * Returns [bucketIndex, sign] for the given token + dimension.
 */
function fnvHashToken(token: string, dim: number): [number, number] {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    // h *= 16777619 (FNV prime) using Math.imul for 32-bit overflow
    h = Math.imul(h, 0x01000193);
  }
  const unsigned = h >>> 0;
  const idx = unsigned % dim;
  const sign = (unsigned & 0x8000) ? -1.0 : 1.0;
  return [idx, sign];
}

function textToVector(text: string, dim = 384): Map<number, number> {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return new Map();
  }

  const counts = new Map<number, number>();

  for (const token of tokens) {
    const [idx, sign] = fnvHashToken(token, dim);
    counts.set(idx, (counts.get(idx) || 0) + sign);
  }

  // Normalize
  let norm = 0;
  for (const val of counts.values()) {
    norm += val * val;
  }
  norm = Math.sqrt(norm);

  if (norm <= 0) {
    return new Map();
  }

  const normalized = new Map<number, number>();
  for (const [idx, val] of counts.entries()) {
    normalized.set(idx, val / norm);
  }

  return normalized;
}

function cosineSimilarity(vecA: Map<number, number>, vecB: Map<number, number>): number {
  if (vecA.size === 0 || vecB.size === 0) {
    return 0;
  }

  // Iterate over the smaller vector
  const [smaller, larger] = vecA.size < vecB.size ? [vecA, vecB] : [vecB, vecA];

  let score = 0;
  for (const [idx, val] of smaller.entries()) {
    score += val * (larger.get(idx) || 0);
  }

  return score;
}

/**
 * Min-heap implementation for efficient top-K selection.
 * Maintains at most K items; inserting N items is O(N log K) vs O(N log N).
 */
class MinHeap<T> {
  private data: { item: T; priority: number }[] = [];

  constructor(private readonly capacity: number) {}

  get size(): number {
    return this.data.length;
  }

  peek(): T | undefined {
    return this.data[0]?.item;
  }

  push(item: T, priority: number): void {
    if (this.data.length < this.capacity) {
      this.data.push({ item, priority });
      this.bubbleUp(this.data.length - 1);
      return;
    }
    // Heap full — only insert if better than current minimum
    if (priority > this.data[0].priority) {
      this.data[0] = { item, priority };
      this.sinkDown(0);
    }
  }

  toSortedArray(): T[] {
    // Sort descending by priority
    return [...this.data]
      .sort((a, b) => b.priority - a.priority)
      .map((entry) => entry.item);
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[parent].priority <= this.data[i].priority) break;
      [this.data[parent], this.data[i]] = [this.data[i], this.data[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.data[left].priority < this.data[smallest].priority) {
        smallest = left;
      }
      if (right < n && this.data[right].priority < this.data[smallest].priority) {
        smallest = right;
      }
      if (smallest === i) break;
      [this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]];
      i = smallest;
    }
  }
}

export function bestMatches(
  query: string,
  items: SearchItem[],
  topK = 5,
  minScore = 0.15
): RankedItem[] {
  const queryVector = getCachedVector(query, 384);

  // Use a min-heap of size topK for O(N log K) selection instead of O(N log N).
  const heap = new MinHeap<RankedItem>(topK);

  for (const item of items) {
    const text = item.searchText?.trim() || '';
    if (!text) continue;

    const itemVector = getCachedVector(text, 384);
    const score = cosineSimilarity(queryVector, itemVector);

    if (score < minScore) continue;

    heap.push(
      {
        ...item,
        score: Math.round(score * 10000) / 10000,
      },
      score, // min-heap priority: smallest score at top
    );
  }

  return heap.toSortedArray();
}

export function calculateSimilarity(textA: string, textB: string): number {
  const vecA = getCachedVector(textA, 384);
  const vecB = getCachedVector(textB, 384);
  return cosineSimilarity(vecA, vecB);
}
