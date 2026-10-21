import type { StreamFn } from "@mariozechner/pi-agent-core";

/**
 * Anthropic rejects a request that carries more than four `cache_control`
 * breakpoints, so every code path that adds breakpoints has to share one
 * budget. The split below uses exactly four: two on the system blocks and two
 * on the last non-system messages.
 */
export const ANTHROPIC_MAX_CACHE_BREAKPOINTS = 4;

/**
 * Section headings that open the run-dependent half of the embedded system
 * prompt.
 *
 * Everything above the first of these headings is byte-stable for a given
 * agent + workspace: the provider prompt, the tool inventory (the single
 * largest block) and the static policy sections. Everything from the heading
 * downwards is derived from the current run: working directory, sandbox info,
 * current time, the injected project context files and the per-run
 * `user.system` additions.
 */
export const DYNAMIC_SYSTEM_PROMPT_HEADINGS = [
  "## Workspace",
  "## Sandbox",
  "## Authorized Senders",
  "## Current Date & Time",
  "## Group Chat Context",
  "## Subagent Context",
  "## Reactions",
  "# Project Context",
  "## Runtime",
] as const;

/**
 * The "## Workspace" section always carries the working directory line. It is
 * used to confirm that the heading we matched really opens that section and
 * not a stray "## Workspace" line inside an injected context file.
 */
const DYNAMIC_SECTION_MARKER = "Your working directory is:";

export type SystemPromptSplit = {
  /** Byte-stable prefix: provider prompt + tool inventory + static policy. */
  stable: string;
  /** Run-dependent suffix. Empty when no split was possible. */
  dynamic: string;
  /** Index of the first character of `dynamic` in the original prompt; -1 when unsplit. */
  boundary: number;
};

export type SplitSystemPromptOptions = {
  prompt: string;
  /** Headings that open the dynamic half. Defaults to {@link DYNAMIC_SYSTEM_PROMPT_HEADINGS}. */
  dynamicHeadings?: readonly string[];
  /**
   * Marker that must appear shortly after the matched heading. Pass `null` to
   * skip the check (used by tests that drive the splitter with synthetic text).
   */
  dynamicMarker?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findSectionStart(prompt: string, headings: readonly string[]): number {
  const wanted = new Set(headings);
  let offset = 0;
  for (const line of prompt.split("\n")) {
    if (wanted.has(line.trim())) {
      return offset;
    }
    offset += line.length + 1;
  }
  return -1;
}

/**
 * Split the embedded system prompt into a byte-stable prefix and a
 * run-dependent suffix.
 *
 * The split is a *contiguous* cut, so the concatenation of the two halves is
 * byte-identical to the original prompt:
 *
 *   joinSystemPromptSplit(splitSystemPrompt({ prompt })) === prompt
 *
 * No section is dropped, reordered or rewritten.
 */
export function splitSystemPrompt(options: SplitSystemPromptOptions): SystemPromptSplit {
  const prompt = options.prompt;
  if (!prompt) {
    return { stable: prompt, dynamic: "", boundary: -1 };
  }
  const headings = options.dynamicHeadings ?? DYNAMIC_SYSTEM_PROMPT_HEADINGS;
  const marker =
    options.dynamicMarker === undefined ? DYNAMIC_SECTION_MARKER : options.dynamicMarker;

  const boundary = findSectionStart(prompt, headings);
  if (boundary <= 0) {
    return { stable: prompt, dynamic: "", boundary: -1 };
  }
  if (marker && !prompt.slice(boundary, boundary + 4_000).includes(marker)) {
    // The heading did not open the expected run-dependent section (for example
    // a stray "## Workspace" line inside an injected file). Fail closed.
    return { stable: prompt, dynamic: "", boundary: -1 };
  }

  // Keep the separator newline in the dynamic half so that rejoining with a
  // single "\n" reproduces the original bytes exactly.
  const stable = prompt.slice(0, boundary).replace(/\n$/, "");
  const dynamic = prompt.slice(boundary);
  if (!stable || !dynamic) {
    return { stable: prompt, dynamic: "", boundary: -1 };
  }
  return { stable, dynamic, boundary };
}

/**
 * Rejoin a split back into the exact text the model receives. Anthropic joins
 * consecutive `system` text blocks with a single newline, so this is the
 * round-trip invariant that keeps the split lossless.
 */
export function joinSystemPromptSplit(split: SystemPromptSplit): string {
  if (!split.dynamic) {
    return split.stable;
  }
  return `${split.stable}\n${split.dynamic}`;
}

/** True when the provider speaks the Anthropic block shape (`cache_control`). */
export function isAnthropicBlockModel(model: unknown): boolean {
  if (!isRecord(model)) {
    return false;
  }
  return model.api === "anthropic-messages";
}

export type AnthropicCacheControl = {
  type: string;
  ttl?: string;
};

export type AnthropicCacheBreakpointResult = {
  applied: boolean;
  /** Number of `cache_control` breakpoints present after the transformation. */
  breakpoints: number;
  reason?: "not-anthropic-payload" | "no-system-text" | "no-split" | "no-cache-control";
};

function readCacheControl(block: unknown): AnthropicCacheControl | undefined {
  if (!isRecord(block)) {
    return undefined;
  }
  const value = block.cache_control;
  if (!isRecord(value) || typeof value.type !== "string") {
    return undefined;
  }
  const ttl = typeof value.ttl === "string" ? value.ttl : undefined;
  return ttl ? { type: value.type, ttl } : { type: value.type };
}

/**
 * Find the cache_control object the provider already put on the payload. It
 * carries the retention TTL chosen by the caller, so reusing it keeps the
 * split consistent with the provider's own caching decision (and keeps
 * `cacheRetention: "none"` meaning "no breakpoints at all").
 */
function findExistingCacheControl(
  payload: Record<string, unknown>,
): AnthropicCacheControl | undefined {
  const system = payload.system;
  if (Array.isArray(system)) {
    for (const block of system) {
      const found = readCacheControl(block);
      if (found) {
        return found;
      }
    }
  }
  const messages = payload.messages;
  if (Array.isArray(messages)) {
    for (const message of messages) {
      if (!isRecord(message)) {
        continue;
      }
      const content = message.content;
      if (!Array.isArray(content)) {
        continue;
      }
      for (const block of content) {
        const found = readCacheControl(block);
        if (found) {
          return found;
        }
      }
    }
  }
  return undefined;
}

function stripCacheControl(payload: Record<string, unknown>): void {
  const system = payload.system;
  if (Array.isArray(system)) {
    for (const block of system) {
      if (isRecord(block)) {
        delete block.cache_control;
      }
    }
  }
  const messages = payload.messages;
  if (Array.isArray(messages)) {
    for (const message of messages) {
      if (!isRecord(message)) {
        continue;
      }
      const content = message.content;
      if (!Array.isArray(content)) {
        continue;
      }
      for (const block of content) {
        if (isRecord(block)) {
          delete block.cache_control;
        }
      }
    }
  }
}

function applyMessageBreakpoint(message: unknown, cacheControl: AnthropicCacheControl): boolean {
  if (!isRecord(message)) {
    return false;
  }
  const content = message.content;
  if (typeof content === "string") {
    if (!content) {
      return false;
    }
    message.content = [{ type: "text", text: content, cache_control: cacheControl }];
    return true;
  }
  if (!Array.isArray(content)) {
    return false;
  }
  for (let i = content.length - 1; i >= 0; i -= 1) {
    const block = content[i];
    if (isRecord(block) && block.type === "text") {
      block.cache_control = cacheControl;
      return true;
    }
  }
  return false;
}

/**
 * Rewrite an Anthropic-shaped request so that the system prompt is sent as two
 * blocks (stable prefix + run-dependent suffix), each carrying its own
 * `cache_control` breakpoint, plus breakpoints on the last two non-system
 * messages.
 *
 * The transformation never emits more than
 * {@link ANTHROPIC_MAX_CACHE_BREAKPOINTS} breakpoints: the provider's own
 * breakpoints are stripped first and exactly four targets are re-applied.
 */
export function applyAnthropicCacheBreakpoints(payload: unknown): AnthropicCacheBreakpointResult {
  if (!isRecord(payload)) {
    return { applied: false, breakpoints: 0, reason: "not-anthropic-payload" };
  }
  const system = payload.system;
  if (!Array.isArray(system)) {
    return { applied: false, breakpoints: 0, reason: "no-system-text" };
  }

  let targetIndex = -1;
  for (let i = system.length - 1; i >= 0; i -= 1) {
    const block = system[i];
    if (isRecord(block) && block.type === "text" && typeof block.text === "string") {
      targetIndex = i;
      break;
    }
  }
  if (targetIndex < 0) {
    return { applied: false, breakpoints: 0, reason: "no-system-text" };
  }

  const target = system[targetIndex] as Record<string, unknown>;
  const split = splitSystemPrompt({ prompt: target.text as string });
  if (!split.dynamic) {
    return { applied: false, breakpoints: 0, reason: "no-split" };
  }

  const cacheControl = findExistingCacheControl(payload);
  if (!cacheControl) {
    // The provider was asked not to cache (cacheRetention: "none").
    return { applied: false, breakpoints: 0, reason: "no-cache-control" };
  }

  stripCacheControl(payload);

  const stableBlock = { ...target, type: "text", text: split.stable, cache_control: cacheControl };
  const dynamicBlock = {
    ...target,
    type: "text",
    text: split.dynamic,
    cache_control: cacheControl,
  };
  payload.system = [
    ...system.slice(0, targetIndex),
    stableBlock,
    dynamicBlock,
    ...system.slice(targetIndex + 1),
  ];

  let breakpoints = 2;
  const messages = payload.messages;
  if (Array.isArray(messages)) {
    const nonSystem = messages.filter(
      (message) => isRecord(message) && message.role !== "system" && message.role !== "developer",
    );
    for (const message of nonSystem.slice(-2)) {
      if (applyMessageBreakpoint(message, cacheControl)) {
        breakpoints += 1;
      }
    }
  }

  return { applied: true, breakpoints: Math.min(breakpoints, ANTHROPIC_MAX_CACHE_BREAKPOINTS) };
}

export type AnthropicPromptCacheWrapperOptions = {
  /** Sink for diagnostics about the applied split. */
  log?: (message: string, data?: Record<string, unknown>) => void;
};

/**
 * Wrap the agent stream function so that Anthropic-shaped requests carry the
 * split system prompt and the four cache breakpoints.
 *
 * Providers that do not speak the Anthropic block shape are passed through
 * untouched: the wrapper does not add a field, does not touch the context and
 * does not change the options.
 */
export function createAnthropicPromptCacheWrapper(
  options: AnthropicPromptCacheWrapperOptions = {},
): (streamFn: StreamFn) => StreamFn {
  return (streamFn: StreamFn): StreamFn => {
    const wrapped: StreamFn = (model, context, streamOptions) => {
      if (!isAnthropicBlockModel(model)) {
        return streamFn(model, context, streamOptions);
      }
      const originalOnPayload = streamOptions?.onPayload;
      return streamFn(model, context, {
        ...streamOptions,
        onPayload: (payload, payloadModel) => {
          try {
            const result = applyAnthropicCacheBreakpoints(payload);
            if (result.applied) {
              options.log?.("anthropic prompt cache breakpoints applied", {
                breakpoints: result.breakpoints,
              });
            }
          } catch (error) {
            options.log?.("anthropic prompt cache breakpoint injection failed", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return originalOnPayload?.(payload, payloadModel);
        },
      });
    };
    return wrapped;
  };
}
