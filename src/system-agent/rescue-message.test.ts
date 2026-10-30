import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { observeHostDataSql } from "../../test/helpers/sqlite-statement-execution-counter.js";
import { createAgent } from "../agents/agent-create.js";
import type { CommandContext } from "../auto-reply/reply/commands-types.js";
import { runDaemonRestart, runDaemonStart, runDaemonStop } from "../cli/daemon-cli/lifecycle.js";
import { runPluginsListCommand } from "../cli/plugins-list-command.js";
import { runPluginsSearchCommand } from "../cli/plugins-search-command.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import {
  createCorePluginStateSyncKeyedStore,
  resetPluginStateStoreForTests,
} from "../plugin-state/plugin-state-store.js";
import { closeOpenClawStateDatabaseAsync } from "../state/paleoclaw-state-db.js";
import { runTui } from "../tui/tui.js";
import { listSystemAgentAuditEntriesForTests } from "./audit.test-support.js";
import { extractSystemAgentRescueMessage, runSystemAgentRescueMessage } from "./rescue-message.js";
import { verifySetupInferenceConfig } from "./setup-inference.js";

let tempRoot = "";
let tempDirId = 0;
let stateDir = "";

type TestConfig = Record<string, unknown>;

const readLastAuditEntry = () => listSystemAgentAuditEntriesForTests().at(-1)?.value ?? {};

const runPluginInstallCommandMock = vi.hoisted(() => vi.fn(async () => undefined));
// mock-isolation: Keep agent creation and its persistent stores outside rescue approval proof.
vi.mock("../agents/agent-create.js", () => ({ createAgent: vi.fn() }));
// mock-isolation: Rescue approval must not manipulate the machine's daemon lifecycle.
vi.mock("../cli/daemon-cli/lifecycle.js", () => ({
  runDaemonRestart: vi.fn(),
  runDaemonStart: vi.fn(),
  runDaemonStop: vi.fn(),
}));
// mock-isolation: Supply external plugin-list output without loading the host CLI registry.
vi.mock("../cli/plugins-list-command.js", () => ({ runPluginsListCommand: vi.fn() }));
// mock-isolation: Supply external plugin-search output without loading the host CLI registry.
vi.mock("../cli/plugins-search-command.js", () => ({ runPluginsSearchCommand: vi.fn() }));
// mock-isolation: Remote rescue must never initialize the local terminal UI.
vi.mock("../tui/tui.js", () => ({ runTui: vi.fn() }));
// mock-isolation: Keep live provider inference outside conversational approval proof.
vi.mock("./setup-inference.js", () => ({ verifySetupInferenceConfig: vi.fn() }));

const mockConfig = vi.hoisted(() => {
  const state = {
    path: "/tmp/openclaw.json",
    config: {} as TestConfig,
    hash: "mock-hash-0" as string | undefined,
  };
  const cloneConfig = () => structuredClone(state.config);
  const snapshot = () => {
    const config = cloneConfig();
    return {
      path: state.path,
      exists: true,
      raw: `${JSON.stringify(config)}\n`,
      parsed: config,
      sourceConfig: config,
      resolved: config,
      valid: true,
      runtimeConfig: config,
      config,
      hash: state.hash,
      issues: [],
      warnings: [],
      legacyIssues: [],
    };
  };
  return {
    reset() {
      state.config = {};
      state.hash = "mock-hash-0";
    },
    currentConfig: cloneConfig,
    readConfigFileSnapshot: vi.fn(async () => snapshot()),
    mutateConfigFile: vi.fn(
      async (params: {
        mutate: (
          draft: TestConfig,
          context: { snapshot: ReturnType<typeof snapshot> },
        ) => Promise<void> | void;
      }) => {
        const before = snapshot();
        const draft = cloneConfig();
        await params.mutate(draft, { snapshot: before });
        state.config = draft;
        state.hash = "mock-hash-1";
        return {
          path: state.path,
          previousHash: before.hash ?? null,
          persistedHash: before.hash ?? null,
          snapshot: before,
          nextConfig: cloneConfig(),
          result: undefined,
        };
      },
    ),
  };
});

vi.mock("../cli/plugins-install-command.js", () => ({
  runPluginInstallCommand: runPluginInstallCommandMock,
}));

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    clearConfigCache: vi.fn(),
    mutateConfigFile: mockConfig.mutateConfigFile,
    readConfigFileSnapshot: mockConfig.readConfigFileSnapshot,
  };
});

vi.mock("../commands/models/shared.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../commands/models/shared.js")>();
  // Avoid a plugin-registry scan; model persistence itself is covered by its owner.
  const update: typeof actual.applyDefaultModelPrimaryUpdate = ({ cfg, modelRaw, field }) => ({
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: { ...cfg.agents?.defaults, [field]: { primary: modelRaw } },
    },
  });
  return { ...actual, applyDefaultModelPrimaryUpdate: update };
});

function commandContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    surface: "whatsapp",
    channel: "whatsapp",
    channelId: "whatsapp",
    accountId: "default",
    ownerList: ["user:owner"],
    senderIsOwner: true,
    isAuthorizedSender: true,
    senderId: "user:owner",
    rawBodyNormalized: "/paleoclaw models",
    commandBodyNormalized: "/paleoclaw models",
    from: "user:owner",
    to: "account:default",
    ...overrides,
  };
}

function openRescuePendingTestStore() {
  return createCorePluginStateSyncKeyedStore<unknown>({
    ownerId: "core:system-agent",
    namespace: "rescue-pending",
    maxEntries: 1_024,
    overflowPolicy: "reject-new",
  });
}

async function runRescue(commandBody: string, cfg: OpenClawConfig = {}, ctx = commandContext()) {
  return await runSystemAgentRescueMessage({
    cfg,
    command: { ...ctx, commandBodyNormalized: commandBody },
    commandBody,
    isGroup: false,
  });
}

async function expectReply(command: string, text: string, exact = false, ctx = commandContext()) {
  const reply = await runRescue(command, {}, ctx);
  if (exact) {
    expect(reply).toBe(text);
  } else {
    expect(reply).toContain(text);
  }
}
const noPending = "No pending paleoclaw rescue change is waiting for approval.";

describe("paleoclaw rescue message", () => {
  beforeAll(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "system-agent-rescue-"));
  });

  beforeEach(async () => {
    stateDir = path.join(tempRoot, String(tempDirId++));
    await fs.mkdir(stateDir, { recursive: true });
    resetPluginStateStoreForTests();
    vi.stubEnv("OPENCLAW_STATE_DIR", stateDir);
    mockConfig.reset();
    runPluginInstallCommandMock.mockClear();
    vi.mocked(runDaemonRestart).mockReset().mockResolvedValue(true);
    vi.mocked(runDaemonStart).mockReset().mockResolvedValue(undefined);
    vi.mocked(runDaemonStop).mockReset().mockResolvedValue(undefined);
    vi.mocked(createAgent).mockReset();
    vi.mocked(runTui).mockReset();
    vi.mocked(runPluginsListCommand).mockReset();
    vi.mocked(runPluginsSearchCommand).mockReset();
    vi.mocked(verifySetupInferenceConfig).mockReset();
  });

  afterAll(async () => {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    vi.useRealTimers();
    try {
      await closeOpenClawStateDatabaseAsync();
    } finally {
      resetPluginStateStoreForTests();
      vi.unstubAllEnvs();
    }
  });

  it("recognizes the paleoclaw rescue command", () => {
    expect(extractSystemAgentRescueMessage("/paleoclaw status")).toBe("status");
    expect(extractSystemAgentRescueMessage("/paleoclaw")).toBe("");
    expect(extractSystemAgentRescueMessage("/status")).toBeNull();
  });

  it("denies rescue when sandboxing is active", async () => {
    await expect(
      runRescue("/paleoclaw status", {
        agents: { defaults: { sandbox: { mode: "all" } } },
      }),
    ).resolves.toContain("sandboxing is active");
  });

  it.each([
    ["talk to agent", "cannot open the local TUI", runTui],
    ["chat", "cannot open the local TUI", runTui],
    ["connect telegram", "cannot host the interactive channel setup", undefined],
    [
      "plugin install PaleoHub:paleoclaw-demo",
      "cannot install plugins from a message channel",
      runPluginInstallCommandMock,
    ],
  ] as const)("refuses remote %s", async (command, reason, effect) => {
    await expectReply(`/paleoclaw ${command}`, reason);
    if (effect) {
      expect(effect).not.toHaveBeenCalled();
    }
  });

  it("rejects natural language instead of guessing an operation", async () => {
    // Questions must never become mutation plans (previously "why did my
    // gateway stop" keyword-matched into a gateway-stop proposal).
    await expectReply("/paleoclaw why did my gateway stop", "I can run doctor/status/health");
    await expectReply(
      "/paleoclaw explain how restart gateway works",
      "I can run doctor/status/health",
    );
    expect(runDaemonStop).not.toHaveBeenCalled();
    expect(runDaemonRestart).not.toHaveBeenCalled();
  });

  it("refuses doctor repairs without creating a pending approval", async () => {
    const reply = await runRescue("/paleoclaw doctor fix", {});
    expect(reply).toContain("machine running paleoclaw");
    expect(reply).toContain("with paleoclaw stopped");
    expect(reply).toContain("run `paleoclaw doctor --fix`");
    await expectReply("/paleoclaw yes", noPending, true);
  });

  it("refuses config deletion without creating a pending approval or writing config", async () => {
    const before = mockConfig.currentConfig();
    mockConfig.mutateConfigFile.mockClear();

    await expectReply(
      "/paleoclaw config unset agents.defaults.fastModeDefault",
      "cannot remove configuration settings",
    );
    await expectReply("/paleoclaw yes", noPending, true);
    expect(mockConfig.mutateConfigFile).not.toHaveBeenCalled();
    expect(mockConfig.currentConfig()).toEqual(before);
    expect(listSystemAgentAuditEntriesForTests()).toEqual([]);
  });

  it("drops a pending rescue change on decline", async () => {
    await expectReply("/paleoclaw restart gateway", "Reply /paleoclaw yes to apply");
    await expectReply("/paleoclaw no", "Dropped the pending paleoclaw rescue change");
    await expectReply("/paleoclaw yes", noPending, true);
    expect(runDaemonRestart).not.toHaveBeenCalled();
  });

  it("revokes a pending write when a fresh read-only command arrives", async () => {
    vi.mocked(runPluginsListCommand).mockImplementation(async (_opts, runtime) =>
      runtime?.log("plugin rows"),
    );

    await expectReply("/paleoclaw restart gateway", "Reply /paleoclaw yes to apply");
    await expectReply("/paleoclaw plugins list", "plugin rows", true);
    await expectReply("/paleoclaw yes", noPending, true);
    expect(runDaemonRestart).not.toHaveBeenCalled();
  });

  it("consumes a pending approval at most once under concurrent approvals", async () => {
    await runRescue("/paleoclaw restart gateway", {});
    const replies = await Promise.all([
      runRescue("/paleoclaw yes", {}),
      runRescue("/paleoclaw yes", {}),
    ]);

    expect(runDaemonRestart).toHaveBeenCalledTimes(1);
    expect(replies).toContain(noPending);
    expect(replies.some((reply) => reply?.includes("[paleoclaw] done: gateway.restart"))).toBe(
      true,
    );
  });

  it("keeps failed execution consumed", async () => {
    vi.mocked(runDaemonRestart).mockImplementation(async () => {
      throw new Error("restart failed");
    });

    await runRescue("/paleoclaw restart gateway", {});
    await expect(runRescue("/paleoclaw yes", {})).rejects.toThrow("restart failed");
    await expectReply("/paleoclaw yes", noPending, true);
    expect(runDaemonRestart).toHaveBeenCalledTimes(1);
  });

  it("preserves a new plan created while the consumed plan executes", async () => {
    const entered = Promise.withResolvers<void>();
    const gate = Promise.withResolvers<void>();
    vi.mocked(runDaemonRestart).mockImplementation(async () => {
      entered.resolve();
      await gate.promise;
      return true;
    });

    await runRescue("/paleoclaw restart gateway", {});
    const approval = runRescue("/paleoclaw yes", {});
    await entered.promise;
    await runRescue("/paleoclaw start gateway", {});
    gate.resolve();
    await expect(approval).resolves.toContain("[paleoclaw] done: gateway.restart");
    await expectReply("/paleoclaw yes", "[paleoclaw] done: gateway.start");
    expect(runDaemonRestart).toHaveBeenCalledTimes(1);
    expect(runDaemonStart).toHaveBeenCalledTimes(1);
  });

  it("publishes concurrently invoked persistent plans in call order", async () => {
    const olderPlan = runRescue("/paleoclaw restart gateway", {});
    const newerPlan = runRescue("/paleoclaw start gateway", {});
    await expect(olderPlan).resolves.toContain("restart the Gateway");
    await expect(newerPlan).resolves.toContain("start the Gateway");
    await expectReply("/paleoclaw yes", "[paleoclaw] done: gateway.start");
    expect(runDaemonRestart).not.toHaveBeenCalled();
    expect(runDaemonStart).toHaveBeenCalledTimes(1);
  });

  it("revokes an invalid replacement through the worker without caller-thread SQL", async () => {
    const sql = observeHostDataSql();
    try {
      await runRescue("/paleoclaw restart gateway", {});
      await expect(
        runRescue(`/paleoclaw config set example ${"x".repeat(1_100_000)}`, {}),
      ).rejects.toThrow(/plugin state value/i);
      await expectReply("/paleoclaw yes", "No pending paleoclaw rescue change");
      await runRescue("/paleoclaw restart gateway", {});
      await expectReply("/paleoclaw no", "Dropped the pending");
      expect(sql.queries).toEqual([]);
      expect(runDaemonRestart).not.toHaveBeenCalled();
    } finally {
      sql.restore();
    }
  });

  it.each(["admission", "effect"] as const)(
    "rechecks rescue authority at %s after consuming approval becomes asynchronous",
    async (stage) => {
      await runRescue("/paleoclaw restart gateway", {});
      let current = true;
      const command = commandContext({
        assertOwnerCurrent: () => {
          if (!current) {
            throw new Error("rescue owner revoked");
          }
        },
      });
      if (stage === "effect") {
        const snapshot = await mockConfig.readConfigFileSnapshot();
        mockConfig.readConfigFileSnapshot.mockImplementationOnce(async () => {
          current = false;
          return snapshot;
        });
      }
      const approving = runRescue("/paleoclaw yes", {}, command);
      if (stage === "admission") {
        current = false;
      }
      await expect(approving).rejects.toThrow();
      expect(runDaemonRestart).not.toHaveBeenCalled();
      expect(openRescuePendingTestStore().entries()).toHaveLength(stage === "admission" ? 1 : 0);
    },
  );

  it("persists a pending approval only in SQLite across store reopen", async () => {
    await runRescue("/paleoclaw restart gateway", {});
    resetPluginStateStoreForTests();

    await expectReply("/paleoclaw yes", "[paleoclaw] done: gateway.restart");
    expect(runDaemonRestart).toHaveBeenCalledTimes(1);
    await expect(fs.access(path.join(stateDir, "paleoclaw", "rescue-pending"))).rejects.toThrow(
      /ENOENT/,
    );
  });

  it.each([
    ["account", {}, { accountId: "secondary" }],
    ["channel", {}, { channelId: "telegram" }],
    ["sender", {}, { from: "user:other", senderId: "user:other" }],
    [
      "destination fallback",
      { accountId: undefined, to: "bot:primary" },
      { accountId: undefined, to: "bot:secondary" },
    ],
  ] as const)("isolates pending approvals by %s", async (_scope, base, other) => {
    const original = commandContext(base);
    await runRescue("/paleoclaw restart gateway", {}, original);
    await expectReply("/paleoclaw yes", noPending, true, commandContext(other));
    await expectReply("/paleoclaw yes", "[paleoclaw] done: gateway.restart", false, original);
    expect(runDaemonRestart).toHaveBeenCalledTimes(1);
  });

  it("allows plugin list and search from remote rescue", async () => {
    vi.mocked(runPluginsListCommand).mockImplementation(async (_opts, runtime) => {
      runtime?.log("plugin rows");
    });
    vi.mocked(runPluginsSearchCommand).mockImplementation(async (query, _opts, runtime) => {
      runtime?.log(`search rows: ${String(query)}`);
    });

    await expectReply("/paleoclaw plugins list", "plugin rows");
    await expectReply("/paleoclaw plugins search calendar", "search rows: calendar");
    expect(runPluginsListCommand).toHaveBeenCalledTimes(1);
    expect(runPluginsSearchCommand).toHaveBeenCalledTimes(1);
    const [searchQuery, , searchRuntime] = vi.mocked(runPluginsSearchCommand).mock.calls[0]!;
    expect(searchQuery).toBe("calendar");
    expect(searchRuntime).toBeTypeOf("object");
  });

  it.each([undefined, "work"])(
    "queues and applies model selection for agent %s through conversational approval",
    async (agentId) => {
      if (agentId) {
        await mockConfig.mutateConfigFile({
          mutate: (draft) => {
            draft.agents = { entries: { [agentId]: {} } };
          },
        });
      }
      vi.mocked(verifySetupInferenceConfig).mockImplementation(async () => ({
        ok: true as const,
        modelRef: "openai/gpt-5.2",
        latencyMs: 17,
      }));
      await expect(
        runRescue(
          `/paleoclaw set default model openai/gpt-5.2${agentId ? ` for agent ${agentId}` : ""}`,
          {},
          commandContext(),
        ),
      ).resolves.toContain("Reply /paleoclaw yes to apply");
      await expect(runRescue("/paleoclaw yes", {})).resolves.toContain(
        agentId ? `Agent ${agentId} model: openai/gpt-5.2` : "Default model: openai/gpt-5.2",
      );

      const currentConfig = mockConfig.currentConfig() as OpenClawConfig;
      const model = agentId
        ? currentConfig.agents?.entries?.[agentId]?.model
        : currentConfig.agents?.defaults?.model;
      expect(typeof model === "string" ? model : model?.primary).toBe("openai/gpt-5.2");
      if (agentId) {
        expect(currentConfig.agents?.defaults?.model).toBeUndefined();
      }
      expect(readLastAuditEntry()).toMatchObject({
        details: {
          rescue: true,
          channel: "whatsapp",
          accountId: "default",
          senderId: "user:owner",
        },
      });
    },
  );

  it("does not queue persistent rescue approval when expiry would exceed the Date range", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(8_640_000_000_000_000));
    try {
      await expectReply("/paleoclaw restart gateway", "expiry clock is invalid");

      await expect(fs.readdir(path.join(stateDir, "paleoclaw", "rescue-pending"))).rejects.toThrow(
        /ENOENT/,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("expires pending approvals through the SQLite row TTL", async () => {
    await runRescue("/paleoclaw restart gateway", {});
    const store = openRescuePendingTestStore();
    const [entry] = store.entries();
    assert(entry, "expected pending rescue row");
    expect(entry.expiresAt! - entry.createdAt).toBe(15 * 60_000);
    // The worker owns its clock. Seed a foreign expired row through the SDK
    // instead of advancing only the host's clock.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    store.register(entry.key, entry.value, { ttlMs: 15 * 60_000 });
    vi.useRealTimers();

    await expectReply("/paleoclaw yes", noPending, true);
    expect(runDaemonRestart).not.toHaveBeenCalled();
  });

  it("consumes malformed pending rows without executing them", async () => {
    await runRescue("/paleoclaw restart gateway", {});
    const store = openRescuePendingTestStore();
    const [entry] = store.entries();
    assert(entry, "expected pending rescue row");
    store.register(
      entry.key,
      { version: 1, operation: { kind: "gateway-restart", unexpected: true } },
      { ttlMs: 60_000 },
    );

    await expectReply("/paleoclaw yes", noPending, true);
    await expectReply("/paleoclaw yes", noPending, true);
    expect(runDaemonRestart).not.toHaveBeenCalled();
  });

  it.each([
    { role: "writer", name: undefined },
    { role: undefined, name: "QA Writer" },
    { role: "writer", name: "QA Writer", purpose: "Write release notes" },
  ])(
    "queues and applies agent creation with role $role, name $name and purpose $purpose through conversational approval",
    async ({ role, name, purpose }) => {
      vi.mocked(createAgent).mockImplementation(async () => ({
        status: "created" as const,
        agentId: "work",
        name: name ?? "work",
        workspace: "/tmp/work",
        agentDir: "/tmp/agent-work",
        bootstrapPending: true,
        config: {},
        configPath: "/tmp/openclaw.json",
      }));

      await expect(
        runRescue(
          `/paleoclaw create agent work${name ? ` name ${JSON.stringify(name)}` : ""}${role ? ` role ${role}` : ""}${purpose ? ` purpose ${JSON.stringify(purpose)}` : ""} workspace /tmp/work`,
          {},
          commandContext(),
        ),
      ).resolves.toBe(
        `Plan: create agent work with workspace /tmp/work${name ? `, name: ${JSON.stringify(name)}` : ""}${purpose ? `, purpose: ${JSON.stringify(purpose)}` : ""}${role ? ", role: Writer" : ""}. Reply /paleoclaw yes to apply.`,
      );
      expect(createAgent).not.toHaveBeenCalled();
      await expectReply("/paleoclaw yes", "[paleoclaw] done: agents.create");

      expect(createAgent).toHaveBeenCalledTimes(1);
      expect(createAgent).toHaveBeenCalledWith({
        entry: {
          id: "work",
          ...(name ? { name, identity: { name } } : {}),
        },
        ...(role ? { role } : {}),
        ...(purpose ? { purpose } : {}),
        workspace: "/tmp/work",
        provenance: { createdVia: "agent", creatorAgentId: "paleoclaw" },
        beforePersistentApply: expect.any(Function),
      });
      expect(readLastAuditEntry()).toMatchObject({
        operation: "agents.create",
        details: {
          rescue: true,
          channel: "whatsapp",
          senderId: "user:owner",
          agentId: "work",
          workspace: "/tmp/work",
        },
      });
    },
  );
});
