import {
  CompactionError,
  SummaryOutputBudgetError,
} from "../../packages/agent-core/src/harness/types.js";
import type { AgentCompactionIdentifierPolicy } from "../config/types.agent-defaults.js";
import { isAbortError } from "../infra/abort-signal.js";
import { sleepWithAbort } from "../infra/backoff.js";
import { formatErrorMessage } from "../infra/errors.js";
import { retryAsync } from "../infra/retry.js";
import { sanitizeCompactionMessages } from "./compaction-planning.js";
import { isTimeoutError } from "./failover-error.js";
import type {
  AgentMessage,
  CompactionSummaryPrompt,
  StreamFn,
  ThinkingLevel,
} from "./runtime/index.js";
import type { SessionModelUsageSink } from "./sessions/compaction/runtime.js";
import type { ExtensionContext } from "./sessions/index.js";
import { generateSummary } from "./sessions/index.js";
export { estimateMessagesTokens } from "./compaction-planning.js";

export const DEFAULT_SUMMARY_FALLBACK = "No prior history.";
const IDENTIFIER_PRESERVATION_INSTRUCTIONS =
  "Preserve all opaque identifiers exactly as written (no shortening or reconstruction), " +
  "including UUIDs, hashes, IDs, hostnames, IPs, ports, URLs, and file names.";

export type CompactionSummarizationInstructions = {
  identifierPolicy?: AgentCompactionIdentifierPolicy | "custom";
  identifierInstructions?: string;
};

type CompactionSummaryParams = {
  messages: AgentMessage[];
  model: NonNullable<ExtensionContext["model"]>;
  apiKey: string;
  headers?: Record<string, string>;
  signal: AbortSignal;
  reserveTokens: number;
  customInstructions?: string;
  summaryPrompt?: CompactionSummaryPrompt;
  summarizationInstructions?: CompactionSummarizationInstructions;
  previousSummary?: string;
  thinkingLevel?: ThinkingLevel;
  streamFn?: StreamFn;
  usageSink?: SessionModelUsageSink;
};

function buildCompactionSummarizationInstructions(
  customInstructions?: string,
  instructions?: CompactionSummarizationInstructions,
): string | undefined {
  const custom = customInstructions?.trim();
  const identifierPreservation =
    instructions?.identifierPolicy === "off"
      ? undefined
      : instructions?.identifierPolicy === "custom"
        ? instructions.identifierInstructions?.trim() || IDENTIFIER_PRESERVATION_INSTRUCTIONS
        : IDENTIFIER_PRESERVATION_INSTRUCTIONS;
  return (
    [identifierPreservation, custom && `Additional focus:\n${custom}`]
      .filter(Boolean)
      .join("\n\n") || undefined
  );
}

/**
 * Summarizes compaction history in one model request. The request serializer
 * bounds its input (see serializeConversationWithinBudget), so latency and cost
 * do not grow with the session or the context window.
 */
export async function summarizeCompactionHistory(params: CompactionSummaryParams): Promise<string> {
  // SECURITY: toolResult.details and runtime-context entries never reach the summarizer.
  const messages = sanitizeCompactionMessages(params.messages);
  if (messages.length === 0) {
    return params.previousSummary ?? DEFAULT_SUMMARY_FALLBACK;
  }
  const instructions = buildCompactionSummarizationInstructions(
    params.customInstructions,
    params.summarizationInstructions,
  );
  try {
    return await retryAsync(
      () =>
        generateSummary(
          messages,
          params.model,
          params.reserveTokens,
          params.apiKey,
          params.headers,
          params.signal,
          instructions,
          params.previousSummary,
          params.thinkingLevel,
          params.streamFn,
          params.usageSink,
          params.summaryPrompt,
        ),
      {
        attempts: 3,
        minDelayMs: 500,
        maxDelayMs: 5000,
        jitter: 0.2,
        label: "compaction/generateSummary",
        // Backoff must honor caller cancellation; otherwise an abort during
        // the sleep would stall compaction until the full delay elapses.
        sleep: (ms) => sleepWithAbort(ms, params.signal),
        // Caller aborts and transport timeouts are terminal; provider-side
        // AbortErrors without caller cancellation remain retryable.
        shouldRetry: (err) =>
          !params.signal.aborted &&
          !(err instanceof SummaryOutputBudgetError) &&
          (isAbortError(err) || !isTimeoutError(err)),
      },
    );
  } catch (err) {
    if (params.signal.aborted) {
      throw err;
    }
    throw new CompactionError(
      "summarization_failed",
      `Summarization failed for ${messages.length} messages: ${formatErrorMessage(err)}`,
      err instanceof Error ? err : undefined,
    );
  }
}

// --- PaleoClaw 兼容层：SUMMARIZATION_OVERHEAD_TOKENS（pc 3 月 API，上游 10 月已改名）---
export const SUMMARIZATION_OVERHEAD_TOKENS = 4096;

export function chunkMessagesByMaxTokens(
  messages: AgentMessage[],
  maxTokens: number,
): AgentMessage[][] {
  if (messages.length === 0) {
    return [];
  }

  // Apply safety margin to compensate for estimateTokens() underestimation
  // (chars/4 heuristic misses multi-byte chars, special tokens, code tokens, etc.)
  const effectiveMax = Math.max(1, Math.floor(maxTokens / SAFETY_MARGIN));

  const chunks: AgentMessage[][] = [];
  let currentChunk: AgentMessage[] = [];
  let currentTokens = 0;

  for (const message of messages) {
    const messageTokens = estimateCompactionMessageTokens(message);
    if (currentChunk.length > 0 && currentTokens + messageTokens > effectiveMax) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }

    currentChunk.push(message);
    currentTokens += messageTokens;

    if (messageTokens > effectiveMax) {
      // Split oversized messages to avoid unbounded chunk growth.
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// --- PaleoClaw 兼容层：computeAdaptiveChunkRatio（pc 3 月 API，上游 10 月已改名）---
export function computeAdaptiveChunkRatio(messages: AgentMessage[], contextWindow: number): number {
  if (messages.length === 0) {
    return BASE_CHUNK_RATIO;
  }

  const totalTokens = estimateMessagesTokens(messages);
  const avgTokens = totalTokens / messages.length;

  // Apply safety margin to account for estimation inaccuracy
  const safeAvgTokens = avgTokens * SAFETY_MARGIN;
  const avgRatio = safeAvgTokens / contextWindow;

  // If average message is > 10% of context, reduce chunk ratio
  if (avgRatio > 0.1) {
    const reduction = Math.min(avgRatio * 2, BASE_CHUNK_RATIO - MIN_CHUNK_RATIO);
    return Math.max(MIN_CHUNK_RATIO, BASE_CHUNK_RATIO - reduction);
  }

  return BASE_CHUNK_RATIO;
}

// --- PaleoClaw 兼容层：isOversizedForSummary（pc 3 月 API，上游 10 月已改名）---
export function isOversizedForSummary(msg: AgentMessage, contextWindow: number): boolean {
  const tokens = estimateCompactionMessageTokens(msg) * SAFETY_MARGIN;
  return tokens > contextWindow * 0.5;
}

// --- PaleoClaw 兼容层：pruneHistoryForContextShare（pc 3 月 API，上游 10 月已改名）---
export function pruneHistoryForContextShare(params: {
  messages: AgentMessage[];
  maxContextTokens: number;
  maxHistoryShare?: number;
  parts?: number;
}): {
  messages: AgentMessage[];
  droppedMessagesList: AgentMessage[];
  droppedChunks: number;
  droppedMessages: number;
  droppedTokens: number;
  keptTokens: number;
  budgetTokens: number;
} {
  const maxHistoryShare = params.maxHistoryShare ?? 0.5;
  const budgetTokens = Math.max(1, Math.floor(params.maxContextTokens * maxHistoryShare));
  let keptMessages = params.messages;
  const allDroppedMessages: AgentMessage[] = [];
  let droppedChunks = 0;
  let droppedMessages = 0;
  let droppedTokens = 0;

  const parts = normalizeParts(params.parts ?? DEFAULT_PARTS, keptMessages.length);

  while (keptMessages.length > 0 && estimateMessagesTokens(keptMessages) > budgetTokens) {
    const chunks = splitMessagesByTokenShare(keptMessages, parts);
    if (chunks.length <= 1) {
      break;
    }
    const [dropped, ...rest] = chunks;
    const flatRest = rest.flat();

    // After dropping a chunk, repair tool_use/tool_result pairing to handle
    // orphaned tool_results (whose tool_use was in the dropped chunk).
    // repairToolUseResultPairing drops orphaned tool_results, preventing
    // "unexpected tool_use_id" errors from Anthropic's API.
    const repairReport = repairToolUseResultPairing(flatRest);
    const repairedKept = repairReport.messages;

    // Track orphaned tool_results as dropped (they were in kept but their tool_use was dropped)
    const orphanedCount = repairReport.droppedOrphanCount;

    droppedChunks += 1;
    droppedMessages += dropped.length + orphanedCount;
    droppedTokens += estimateMessagesTokens(dropped);
    // Note: We don't have the actual orphaned messages to add to droppedMessagesList
    // since repairToolUseResultPairing doesn't return them. This is acceptable since
    // the dropped messages are used for summarization, and orphaned tool_results
    // without their tool_use context aren't useful for summarization anyway.
    allDroppedMessages.push(...dropped);
    keptMessages = repairedKept;
  }

  return {
    messages: keptMessages,
    droppedMessagesList: allDroppedMessages,
    droppedChunks,
    droppedMessages,
    droppedTokens,
    keptTokens: estimateMessagesTokens(keptMessages),
    budgetTokens,
  };
}

// --- PaleoClaw 兼容层：resolveContextWindowTokens（pc 3 月 API，上游 10 月已改名）---
export function resolveContextWindowTokens(model?: ExtensionContext["model"]): number {
  return Math.max(1, Math.floor(model?.contextWindow ?? DEFAULT_CONTEXT_TOKENS));
}

// --- PaleoClaw 兼容层：summarizeInStages（pc 3 月 API，上游 10 月已改名）---
export async function summarizeInStages(params: {
  messages: AgentMessage[];
  model: NonNullable<ExtensionContext["model"]>;
  apiKey: string;
  signal: AbortSignal;
  reserveTokens: number;
  maxChunkTokens: number;
  contextWindow: number;
  customInstructions?: string;
  summarizationInstructions?: CompactionSummarizationInstructions;
  previousSummary?: string;
  parts?: number;
  minMessagesForSplit?: number;
}): Promise<string> {
  const { messages } = params;
  if (messages.length === 0) {
    return params.previousSummary ?? DEFAULT_SUMMARY_FALLBACK;
  }

  const minMessagesForSplit = Math.max(2, params.minMessagesForSplit ?? 4);

  if (parts <= 1 || messages.length < minMessagesForSplit || totalTokens <= params.maxChunkTokens) {
    return summarizeWithFallback(params);
  }

  const splits = splitMessagesByTokenShare(messages, parts).filter((chunk) => chunk.length > 0);
  if (splits.length <= 1) {
    return summarizeWithFallback(params);
  }

  const partialSummaries: string[] = [];
  for (const chunk of splits) {
    partialSummaries.push(
      await summarizeWithFallback({
        ...params,
        messages: chunk,
        previousSummary: undefined,
      }),
    );
  }

  if (partialSummaries.length === 1) {
    return partialSummaries[0];
  }

  const summaryMessages: AgentMessage[] = partialSummaries.map((summary) => ({
    role: "user",
    content: summary,
    timestamp: Date.now(),
  }));

  const mergeInstructions = custom
    ? `${MERGE_SUMMARIES_INSTRUCTIONS}\n\n${custom}`
    : MERGE_SUMMARIES_INSTRUCTIONS;

  return summarizeWithFallback({
    ...params,
    messages: summaryMessages,
    customInstructions: mergeInstructions,
  });
}

// --- PaleoClaw 兼容层：BASE_CHUNK_RATIO（pc 3 月 API，上游 10 月已改名）---
export const BASE_CHUNK_RATIO = 0.4;
export const MIN_CHUNK_RATIO = 0.15;

// --- PaleoClaw 兼容层：SAFETY_MARGIN（pc 3 月 API，上游 10 月已改名）---
export const SAFETY_MARGIN = 1.2; // 20% buffer for estimateTokens() inaccuracy
