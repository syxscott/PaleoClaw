/**
 * Local literature summary helper tool
 */

import { toolRegistry } from './registry.js';

interface SummaryParams {
  title?: string;
  abstract?: string;
  maxPoints?: number;
}

function splitSentences(text: string): string[] {
  return text
    .split(/[。！？.!?]\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function summaryHandler(params: Record<string, unknown>): unknown {
  const typed = params as SummaryParams;
  const title = String(typed.title || '').trim();
  const abstract = String(typed.abstract || '').trim();
  const maxPoints = Math.max(1, Math.min(8, Number(typed.maxPoints || 4)));

  if (!abstract) {
    throw new Error('abstract is required');
  }

  const sentences = splitSentences(abstract).slice(0, maxPoints);
  return {
    title,
    bulletPoints: sentences,
    recommendation: sentences.length > 0
      ? '建议继续抓取 DOI、年代地层信息并与 PBDB 记录交叉验证。'
      : '摘要内容不足，建议补充完整摘要后重试。',
  };
}

toolRegistry.register({
  name: 'literature_summary',
  category: 'analysis',
  description: 'Generate a concise bullet summary from a paper abstract',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Paper title' },
      abstract: { type: 'string', description: 'Paper abstract text' },
      maxPoints: { type: 'number', description: 'Max summary bullets (1-8)' },
    },
    required: ['abstract'],
  },
  handler: summaryHandler,
  timeoutMs: 2_000,
});

export {};
