/**
 * PaleoClaw Memory Retrieval - Vector-based similarity search
 * Adapted from GeoClaw-OpenAI v2.4.0
 */

import * as crypto from 'crypto';

const TOKEN_REGEX = /[A-Za-z0-9_]+|[\u4e00-\u9fff]/g;

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

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    tokens.push(match[0].toLowerCase());
  }
  return tokens;
}

function textToVector(text: string, dim = 384): Map<number, number> {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return new Map();
  }
  
  const counts = new Map<number, number>();
  
  for (const token of tokens) {
    const hash = crypto.createHash('md5').update(token, 'utf-8').digest('hex');
    const idx = parseInt(hash.slice(0, 8), 16) % dim;
    const sign = parseInt(hash.slice(8, 10), 16) % 2 === 0 ? 1.0 : -1.0;
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

export function bestMatches(
  query: string,
  items: SearchItem[],
  topK = 5,
  minScore = 0.15
): RankedItem[] {
  const queryVector = textToVector(query);
  
  const ranked: RankedItem[] = [];
  
  for (const item of items) {
    const text = item.searchText?.trim() || '';
    if (!text) continue;
    
    const itemVector = textToVector(text);
    const score = cosineSimilarity(queryVector, itemVector);
    
    if (score < minScore) continue;
    
    ranked.push({
      ...item,
      score: Math.round(score * 10000) / 10000,
    });
  }
  
  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score);
  
  return ranked.slice(0, Math.max(1, topK));
}

export function calculateSimilarity(textA: string, textB: string): number {
  const vecA = textToVector(textA);
  const vecB = textToVector(textB);
  return cosineSimilarity(vecA, vecB);
}
