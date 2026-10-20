import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { Context, Model } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";
import { buildAgentSystemPrompt } from "../system-prompt.js";
import {
  ANTHROPIC_MAX_CACHE_BREAKPOINTS,
  applyAnthropicCacheBreakpoints,
  createAnthropicPromptCacheWrapper,
  joinSystemPromptSplit,
  splitSystemPrompt,
} from "./system-prompt-split.js";

/**
 * A trimmed-down replica of the embedded system prompt: the stable prefix
 * (provider prompt + tool inventory) followed by the run-dependent sections.
 */
const SYSTEM_PROMPT = [
  "You are a personal assistant running inside paleoclaw.",
  "## Tooling",
  "Tool availability (filtered by policy):",
  "- read: Read file contents",
  "- write: Create or overwrite files",
  "- exec: Run shell commands",
  "## Tool Call Style",
  "Default: do not narrate routine, low-risk tool calls (just call the tool).",
  "## Safety",
  "You have no independent goals.",
  "## Workspace",
  "Your working directory is: D:/work/project",
  "Treat this directory as the single global workspace for file operations.",
  "## Current Date & Time",
  "Time zone: Asia/Shanghai",
  "## Runtime",
  "Runtime: host=DESKTOP | os=Windows | model=anthropic/claude-x",
].join("\n");

const anthropicModel: Model<"anthropic-messages"> = {
  id: "claude-x",
  name: "claude-x",
  api: "anthropic-messages",
  provider: "anthropic",
  baseUrl: "https://api.anthropic.com",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 200_000,
  maxTokens: 8_192,
};

const openAiModel: Model<"openai-completions"> = {
  ...anthropicModel,
  api: "openai-completions",
  provider: "openai",
};

function anthropicPayload(system: string) {
  return {
    model: "claude-x",
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [
      { role: "user", content: "hello" },
      { role: "assistant", content: [{ type: "text", text: "hi" }] },
      { role: "user", content: "more" },
    ],
  };
}

function countCacheControl(payload: unknown): number {
  const record = payload as Record<string, unknown>;
  let count = 0;
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    const entry = value as Record<string, unknown>;
    if (entry.cache_control) {
      count += 1;
    }
    for (const nested of Object.values(entry)) {
      visit(nested);
    }
  };
  visit(record.system);
  visit(record.messages);
  return count;
}

describe("splitSystemPrompt", () => {
  it("keeps the tool definitions in the stable half", () => {
    const split = splitSystemPrompt({ prompt: SYSTEM_PROMPT });

    expect(split.stable).toContain("## Tooling");
    expect(split.stable).toContain("- exec: Run shell commands");
    expect(split.dynamic).not.toContain("## Tooling");
  });

  it("keeps the run-dependent sections in the dynamic half", () => {
    const split = splitSystemPrompt({ prompt: SYSTEM_PROMPT });

    expect(split.dynamic).toContain("## Workspace");
    expect(split.dynamic).toContain("Your working directory is: D:/work/project");
    expect(split.dynamic).toContain("## Current Date & Time");
    expect(split.dynamic).toContain("## Runtime");
    expect(split.stable).not.toContain("Your working directory is:");
  });

  it("is lossless: stable + newline + dynamic equals the original prompt", () => {
    const split = splitSystemPrompt({ prompt: SYSTEM_PROMPT });

    expect(joinSystemPromptSplit(split)).toBe(SYSTEM_PROMPT);
  });

  it("is lossless for a prompt with a blank line before the dynamic section", () => {
    const prompt = `${SYSTEM_PROMPT}\n\n## Workspace\nYour working directory is: /tmp`;

    const split = splitSystemPrompt({ prompt });

    expect(joinSystemPromptSplit(split)).toBe(prompt);
  });

  it("does not split when no dynamic section is present", () => {
    const prompt = "You are a personal assistant running inside paleoclaw.";

    const split = splitSystemPrompt({ prompt });

    expect(split.dynamic).toBe("");
    expect(split.stable).toBe(prompt);
    expect(joinSystemPromptSplit(split)).toBe(prompt);
  });

  it("fails closed when the matched heading is not the workspace section", () => {
    const prompt = [
      "You are a personal assistant running inside paleoclaw.",
      "## Workspace",
      "not the real workspace section",
    ].join("\n");

    const split = splitSystemPrompt({ prompt });

    expect(split.dynamic).toBe("");
    expect(split.stable).toBe(prompt);
  });
});

describe("splitSystemPrompt with the real system prompt builder", () => {
  const realPrompt = buildAgentSystemPrompt({
    workspaceDir: "D:/work/project",
    toolNames: ["read", "write", "exec"],
    toolSummaries: {},
    modelAliasLines: ["sonnet -> anthropic/claude-sonnet-4"],
    userTimezone: "Asia/Shanghai",
    userTime: "2026-01-01 10:00",
    runtimeInfo: {
      host: "DESKTOP",
      os: "Windows",
      arch: "x64",
      node: "v22",
      model: "anthropic/claude-x",
    },
  });

  it("is lossless for the prompt the runtime actually builds", () => {
    const split = splitSystemPrompt({ prompt: realPrompt });

    expect(joinSystemPromptSplit(split)).toBe(realPrompt);
  });

  it("puts the tool definitions in the stable half", () => {
    const split = splitSystemPrompt({ prompt: realPrompt });

    expect(split.stable).toContain("## Tooling");
    expect(split.stable).toContain("- exec: Run shell commands");
    expect(split.dynamic).not.toContain("## Tooling");
  });

  it("puts the environment-derived sections in the dynamic half", () => {
    const split = splitSystemPrompt({ prompt: realPrompt });

    expect(split.dynamic).toContain("Your working directory is:");
    expect(split.dynamic).toContain("Time zone: Asia/Shanghai");
    expect(split.dynamic).toContain("## Runtime");
    expect(split.stable).not.toContain("Your working directory is:");
  });
});

describe("applyAnthropicCacheBreakpoints", () => {
  it("splits the system prompt into two blocks with a breakpoint each", () => {
    const payload = anthropicPayload(SYSTEM_PROMPT);

    const result = applyAnthropicCacheBreakpoints(payload);

    expect(result.applied).toBe(true);
    const system = payload.system as Array<{ type: string; text: string; cache_control?: unknown }>;
    expect(system).toHaveLength(2);
    expect(system[0]?.text).toBe(splitSystemPrompt({ prompt: SYSTEM_PROMPT }).stable);
    expect(system[1]?.text).toBe(splitSystemPrompt({ prompt: SYSTEM_PROMPT }).dynamic);
    expect(system[0]?.cache_control).toEqual({ type: "ephemeral" });
    expect(system[1]?.cache_control).toEqual({ type: "ephemeral" });
  });

  it("never emits more than four cache breakpoints", () => {
    const payload = anthropicPayload(SYSTEM_PROMPT);

    const result = applyAnthropicCacheBreakpoints(payload);

    expect(result.breakpoints).toBeLessThanOrEqual(ANTHROPIC_MAX_CACHE_BREAKPOINTS);
    expect(countCacheControl(payload)).toBeLessThanOrEqual(ANTHROPIC_MAX_CACHE_BREAKPOINTS);
  });

  it("places breakpoints on the last two non-system messages", () => {
    const payload = anthropicPayload(SYSTEM_PROMPT);

    applyAnthropicCacheBreakpoints(payload);

    const messages = payload.messages as Array<Record<string, unknown>>;
    const assistantBlocks = messages[1]?.content as Array<Record<string, unknown>>;
    const userBlocks = messages[2]?.content as Array<Record<string, unknown>>;
    expect(assistantBlocks?.[0]?.cache_control).toEqual({ type: "ephemeral" });
    expect(userBlocks?.[0]?.cache_control).toEqual({ type: "ephemeral" });
  });

  it("is a no-op when the provider did not ask for caching", () => {
    const payload = {
      model: "claude-x",
      system: [{ type: "text", text: SYSTEM_PROMPT }],
      messages: [{ role: "user", content: "hello" }],
    };
    const before = JSON.stringify(payload);

    const result = applyAnthropicCacheBreakpoints(payload);

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("no-cache-control");
    expect(JSON.stringify(payload)).toBe(before);
  });

  it("is a no-op when the system prompt cannot be split", () => {
    const payload = {
      model: "claude-x",
      system: [{ type: "text", text: "short prompt", cache_control: { type: "ephemeral" } }],
      messages: [],
    };
    const before = JSON.stringify(payload);

    const result = applyAnthropicCacheBreakpoints(payload);

    expect(result.applied).toBe(false);
    expect(JSON.stringify(payload)).toBe(before);
  });
});

describe("createAnthropicPromptCacheWrapper", () => {
  it("leaves non-Anthropic providers byte-identical", async () => {
    const payload = {
      model: "gpt-x",
      messages: [{ role: "system", content: SYSTEM_PROMPT }],
    };
    const before = JSON.stringify(payload);
    let seenOptions: unknown;
    const streamFn: StreamFn = (_model, _context, options) => {
      seenOptions = options;
      return {} as ReturnType<StreamFn>;
    };
    const context: Context = { systemPrompt: SYSTEM_PROMPT, messages: [] };

    const wrapped = createAnthropicPromptCacheWrapper()(streamFn);
    void wrapped(openAiModel, context, {});

    expect(seenOptions).toEqual({});
    expect(JSON.stringify(payload)).toBe(before);
  });

  it("adds the split system blocks for Anthropic providers", () => {
    const payload = anthropicPayload(SYSTEM_PROMPT);
    const streamFn: StreamFn = (_model, _context, options) => {
      options?.onPayload?.(payload, anthropicModel);
      return {} as ReturnType<StreamFn>;
    };
    const context: Context = { systemPrompt: SYSTEM_PROMPT, messages: [] };

    const wrapped = createAnthropicPromptCacheWrapper()(streamFn);
    void wrapped(anthropicModel, context, {});

    expect(payload.system).toHaveLength(2);
    expect(countCacheControl(payload)).toBeLessThanOrEqual(ANTHROPIC_MAX_CACHE_BREAKPOINTS);
  });

  it("never lets a failing payload hook break the request", () => {
    const streamFn: StreamFn = (_model, _context, options) => {
      options?.onPayload?.({ system: "not-an-array" }, anthropicModel);
      return {} as ReturnType<StreamFn>;
    };
    const context: Context = { systemPrompt: SYSTEM_PROMPT, messages: [] };
    const log = vi.fn();

    const wrapped = createAnthropicPromptCacheWrapper({ log })(streamFn);

    expect(() => void wrapped(anthropicModel, context, {})).not.toThrow();
  });
});
