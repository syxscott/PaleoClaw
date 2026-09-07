import { ContextEngine } from './context-engine.js';

interface CompressionResult {
  compressed: Array<{ role: string; content: string }>;
  summary: string;
}

const COMPRESSED_SUMMARY_METADATA_KEY = '_compressed_summary';

export class ContextCompressor extends ContextEngine {
  name = 'context-compressor';

  // Note: do NOT use `private` parameter properties here — the base class
  // already declares these as public fields, and parameter properties would
  // redeclare them as private, breaking ContextEngine assignability.
  constructor(
    contextLength: number = 128000,
    thresholdPercent: number = 0.9,
    protectFirstN: number = 2,
    protectLastN: number = 5
  ) {
    super();
    this.contextLength = contextLength;
    this.thresholdPercent = thresholdPercent;
    this.protectFirstN = protectFirstN;
    this.protectLastN = protectLastN;
    this.thresholdTokens = Math.floor(contextLength * thresholdPercent);
  }

  update_from_response(response: any): void {
    if (response.usage) {
      this.lastPromptTokens = response.usage.prompt_tokens || 0;
      this.lastCompletionTokens = response.usage.completion_tokens || 0;
      this.lastTotalTokens = response.usage.total_tokens || 0;
    }
  }

  should_compress(): boolean {
    return this.lastTotalTokens >= this.thresholdTokens;
  }

  compress(messages: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
    if (!this.should_compress()) return messages;
    if (messages.length <= this.protectFirstN + this.protectLastN) return messages;

    const protectedStart = messages.slice(0, this.protectFirstN);
    const protectedEnd = messages.slice(-this.protectLastN);
    const middle = messages.slice(this.protectFirstN, -this.protectLastN);

    if (middle.length === 0) return messages;

    // Simple compression: summarize middle messages
    const summary = this.summarize(middle);
    const compressedSummary = {
      role: 'system',
      content: `[Previous conversation summarized (${middle.length} messages removed): ${summary}]`,
      [COMPRESSED_SUMMARY_METADATA_KEY]: true,
    };

    this.compressionCount++;
    return [...protectedStart, compressedSummary, ...protectedEnd];
  }

  private summarize(messages: Array<{ role: string; content: string }>): string {
    // Simple summarization - in production this could call an LLM
    const totalLength = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    const topics = this.extractTopics(messages);
    return `${messages.length} messages (${totalLength} chars) about: ${topics.join(', ')}`;
  }

  private extractTopics(messages: Array<{ role: string; content: string }>): string[] {
    const words = new Set<string>();
    for (const msg of messages) {
      const content = msg.content?.toLowerCase() || '';
      const matches = content.match(/\b[a-z]{4,}\b/g) || [];
      matches.forEach(w => words.add(w));
    }
    return Array.from(words).slice(0, 5);
  }
}
