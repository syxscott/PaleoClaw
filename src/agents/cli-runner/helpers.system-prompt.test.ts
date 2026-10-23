import { Type } from "typebox";
// Verifies CLI system-prompt construction without loading the full runner.
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearPluginCommands, registerPluginCommand } from "../../plugins/commands.js";
import { resolveSessionGitCoauthorPrompt } from "../git-coauthor-prompt.js";
import { createStubTool } from "../test-helpers/agent-tool-stubs.js";
import { buildCliAgentSystemPrompt } from "./helpers.js";
import { prepareCliSystemPrompt } from "./prompt-context.js";

vi.mock("../git-coauthor-prompt.js", () => ({
  resolveSessionGitCoauthorPrompt: vi.fn(),
}));

vi.mock("../../tts/tts-settings.js", () => ({
  buildTtsSystemPromptHint: vi.fn(() => undefined),
  resolveModelOverridePolicy: vi.fn(),
  setTtsMachinePrefsPathResolver: vi.fn(),
}));

describe("buildCliAgentSystemPrompt", () => {
  afterEach(() => {
    clearPluginCommands();
    vi.mocked(resolveSessionGitCoauthorPrompt).mockReset();
  });

  it("prepares session credit before rendering the CLI system prompt", async () => {
    const gitCoauthorPrompt =
      "Git co-authors: add these exact trailers to every commit you make from this session.\n" +
      "Co-authored-by: ada <20+ada@users.noreply.github.com>";
    vi.mocked(resolveSessionGitCoauthorPrompt).mockResolvedValue(gitCoauthorPrompt);
    const config = {};
    const prompt = await prepareCliSystemPrompt({
      workspaceDir: "/tmp/paleoclaw",
      config,
      agentId: "main",
      sessionKey: "agent:main:shared",
      sessionId: "shared-session",
      tools: [],
      modelDisplay: "test/model",
    });

    expect(prompt).toContain(gitCoauthorPrompt);
    expect(resolveSessionGitCoauthorPrompt).toHaveBeenCalledExactlyOnceWith({
      config,
      agentId: "main",
      sessionKey: "agent:main:shared",
      sessionId: "shared-session",
    });
  });

  it("includes the paleoclaw skills prompt in CLI system prompts", () => {
    const preparedModelRuntime = {
      isCurrent: vi.fn(() => true),
      configuredModelAliases: [{ alias: "Current", provider: "fixture", model: "current" }],
    };
    const params = {
      workspaceDir: "/tmp",
      modelDisplay: "claude-cli/sonnet",
      config: { agents: { defaults: { model: "fixture/current" } } },
      preparedModelRuntime,
      tools: [],
      skillsPrompt: [
        "<available_skills>",
        "  <skill>",
        "    <name>weather</name>",
        "    <description>Use weather tools.</description>",
        "    <location>/tmp/skills/weather/SKILL.md</location>",
        "  </skill>",
        "</available_skills>",
      ].join("\n"),
    };
    const systemPrompt = buildCliAgentSystemPrompt(params);

    expect(systemPrompt).toContain("<name>weather</name>");
    expect(systemPrompt).toContain("- Current: fixture/current");
    preparedModelRuntime.isCurrent.mockReturnValue(false);
    expect(buildCliAgentSystemPrompt(params)).not.toContain("## Model Aliases");
  });

  it.each([true, false])(
    "gates PaleoHub guidance on the CLI tool schema (available=%s)",
    (available) => {
      const message = createStubTool("message");
      message.parameters = Type.Object(
        available ? { PaleoHub: Type.Object({ query: Type.String() }) } : {},
      );
      const prompt = buildCliAgentSystemPrompt({
        workspaceDir: "/tmp/paleoclaw",
        tools: [message],
        runtimeChannel: "webchat",
        modelDisplay: "test/model",
      });

      expect(
        prompt.includes("For explicit plugin/skill search/install or missing capability"),
      ).toBe(available);
    },
  );

  it("uses config-backed sub-agent delegation mode", () => {
    const prompt = buildCliAgentSystemPrompt({
      workspaceDir: "/tmp/paleoclaw",
      config: {
        agents: {
          defaults: {
            subagents: {
              delegationMode: "prefer",
            },
          },
        },
      },
      agentId: "main",
      tools: [{ name: "sessions_spawn" } as never],
      modelDisplay: "test/model",
    });

    expect(prompt).toContain("## Delegation");
  });

  it("uses CLI backend tool fallback instead of paleoclaw tool assumptions", () => {
    const prompt = buildCliAgentSystemPrompt({
      workspaceDir: "/tmp/paleoclaw",
      docsPath: "/tmp/paleoclaw/docs",
      tools: [],
      modelDisplay: "test/model",
    });

    expect(prompt).toContain("No paleoclaw tool list is injected");
    expect(prompt).not.toContain("exec approval-pending");
  });

  it("distinguishes the CLI working directory from the agent workspace", () => {
    const prompt = buildCliAgentSystemPrompt({
      workspaceDir: "/tmp/paleoclaw-agent",
      cwd: "/tmp/task-repo",
      tools: [],
      modelDisplay: "test/model",
    });

    expect(prompt).toContain("Working directory: /tmp/task-repo");
    expect(prompt).toContain("Agent workspace: /tmp/paleoclaw-agent");
    expect(prompt).not.toContain("Working directory: /tmp/paleoclaw-agent");
  });

  it("renders the Bootstrap Pending gate for full bootstrap mode", () => {
    // CLI-backend runs must gate the first reply on a pending BOOTSTRAP.md the
    // same way the embedded runner does, not just inject the file as context.
    const prompt = buildCliAgentSystemPrompt({
      workspaceDir: "/tmp/paleoclaw",
      tools: [],
      contextFiles: [
        {
          path: "/tmp/paleoclaw/BOOTSTRAP.md",
          content: "Figure out who you are, then delete this file.",
        },
      ],
      bootstrapMode: "full",
      modelDisplay: "test/model",
    });

    expect(prompt).toContain("## Bootstrap Pending");
    expect(prompt).toContain("Can finish BOOTSTRAP.md here: do it.");
  });

  it("renders limited bootstrap guidance when the run cannot complete bootstrap", () => {
    const prompt = buildCliAgentSystemPrompt({
      workspaceDir: "/tmp/paleoclaw",
      tools: [],
      bootstrapMode: "limited",
      modelDisplay: "test/model",
    });

    expect(prompt).toContain("this run cannot safely finish full BOOTSTRAP.md");
  });

  it("includes CLI-scoped plugin command guidance", () => {
    // Plugin command guidance is surface-filtered; CLI prompts must not leak
    // paleoclaw-main command text into external CLI backends.
    registerPluginCommand("demo-plugin", {
      name: "demo_cli",
      description: "Demo CLI command",
      agentPromptGuidance: [
        {
          text: "CLI-only command guidance.",
          surfaces: ["cli_backend"],
        },
        {
          text: "paleoclaw-only command guidance.",
          surfaces: ["openclaw_main"],
        },
      ],
      handler: async () => ({ text: "ok" }),
    });

    const prompt = buildCliAgentSystemPrompt({
      workspaceDir: "/tmp/paleoclaw",
      tools: [{ name: "exec" } as never],
      modelDisplay: "test/model",
    });

    expect(prompt).toContain("CLI-only command guidance.");
    expect(prompt).not.toContain("paleoclaw-only command guidance.");
  });

  it("includes session identity in runtime when provided", () => {
    const prompt = buildCliAgentSystemPrompt({
      workspaceDir: "/tmp/paleoclaw",
      config: {
        agents: {
          entries: {
            "Team Ops": { identity: { name: "Ops Navigator" } },
          },
        },
      },
      tools: [],
      modelDisplay: "test/model",
      agentId: "team-ops",
      sessionKey: "agent:team-ops:telegram:direct:peer",
      sessionId: "session-123",
    });

    expect(prompt).toContain(
      "Runtime: name=Ops Navigator | agent=team-ops | session=agent:team-ops:telegram:direct:peer",
    );
  });

  it("includes Telegram channel context for CLI final replies without core rich guidance", () => {
    const prompt = buildCliAgentSystemPrompt({
      workspaceDir: "/tmp/paleoclaw",
      tools: [],
      modelDisplay: "anthropic/claude-opus-4-8",
      runtimeChannel: "telegram",
      runtimeChatType: "direct",
    });

    expect(prompt).toContain("channel=telegram");
    expect(prompt).not.toContain("Telegram rich ON");
    expect(prompt).not.toContain("### message tool");
  });

  it.each(["mattermost", "slack"])("preserves %s channel-owned button guidance", (channel) => {
    const prompt = buildCliAgentSystemPrompt({
      workspaceDir: "/tmp/paleoclaw",
      tools: [createStubTool("message")],
      modelDisplay: "test/model",
      runtimeChannel: channel,
      runtimeCapabilities: ["inlineButtons"],
      customInlineButtonHint: true,
      messageToolHints: ["- Use the channel's supported button shape."],
    });

    expect(prompt).toContain("- Use the channel's supported button shape.");
    expect(prompt).not.toContain('"action":{"type":"callback"');
    expect(prompt).not.toContain("Inline buttons OFF");
  });

  it("requires an explicit message target when the CLI turn policy requires one", () => {
    const prompt = buildCliAgentSystemPrompt({
      workspaceDir: "/tmp/paleoclaw",
      tools: [{ name: "message" } as never],
      modelDisplay: "test/model",
      sourceReplyDeliveryMode: "message_tool_only",
      requireExplicitMessageTarget: true,
    });

    expect(prompt).toContain("`send`: `target` + `message`; target required this turn");
    expect(prompt).not.toContain("current source is default target");
  });
});
