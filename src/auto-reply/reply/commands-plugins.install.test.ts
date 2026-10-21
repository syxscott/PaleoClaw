import fs from "node:fs/promises";
import path from "node:path";
import { expectDefined } from "@paleoclaw/normalization-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withTempHome } from "../../config/home-env.test-harness.js";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import { invokePluginArtifactInstallMock } from "../../plugins/test-helpers/install-fixtures.js";
import { expectObjectFields, mockFirstObjectArg } from "../../test-utils/mock-call-assertions.js";
import { createCommandWorkspaceHarness } from "./commands-filesystem.test-support.js";
import {
  clawHubInstallResult,
  committedPluginMetadata,
} from "./commands-plugins.install.test-support.js";
import { handlePluginsCommand } from "./commands-plugins.js";
import { buildPluginsCommandParams } from "./commands.test-harness.js";

// Default-selector assertions describe a stable build; beta cases set their own identity.
const coreVersion = vi.hoisted(() => ({ value: "2026.8.1" }));
vi.mock("../../version.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../version.js")>()),
  get VERSION() {
    return coreVersion.value;
  },
}));

const mocks = vi.hoisted(() => ({
  archive: vi.fn(),
  npm: vi.fn(),
  path: vi.fn(),
  hub: vi.fn(),
  git: vi.fn(),
  persist: vi.fn(),
  metadata: vi.fn(),
}));

vi.mock("../../infra/install-source-utils.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../infra/install-source-utils.js")>()),
  resolveNpmSpecMetadata: mocks.metadata,
}));

vi.mock("../../plugins/install.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../plugins/install.js")>()),
  installPluginFromNpmPackArchive: invokePluginArtifactInstallMock.bind(null, mocks.archive),
  installPluginFromNpmSpec: invokePluginArtifactInstallMock.bind(null, mocks.npm),
  installPluginFromPath: invokePluginArtifactInstallMock.bind(null, mocks.path),
}));

vi.mock("../../plugins/clawhub.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../plugins/PaleoHub.js")>()),
  installPluginFromClawHub: invokePluginArtifactInstallMock.bind(null, mocks.hub),
}));

vi.mock("../../plugins/git-install.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../plugins/git-install.js")>()),
  installPluginFromGitSpec: invokePluginArtifactInstallMock.bind(null, mocks.git),
}));

vi.mock("../../plugins/install-persistence.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../plugins/install-persistence.js")>()),
  persistPluginInstall: mocks.persist,
}));

vi.mock("../../plugins/official-external-plugin-catalog.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../plugins/official-external-plugin-catalog.js")>()),
  loadConfiguredHostedOfficialExternalPluginCatalogEntries: async () => ({
    source: "hosted",
    entries: [],
  }),
}));
vi.mock("../../plugins/management-service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../plugins/management-service.js")>()),
  refreshManagedPluginMetadata: () => committedPluginMetadata(mocks.persist.mock.lastCall?.[0]),
}));

const workspaceHarness = createCommandWorkspaceHarness("paleoclaw-command-plugins-install-");

async function withInstallWorkspace(run: (workspaceDir: string, home: string) => Promise<void>) {
  await withTempHome("paleoclaw-command-plugins-home-", async (home) => {
    await run(await workspaceHarness.createWorkspace(), home);
  });
}

const createInstallPolicyConfig = (): OpenClawConfig => ({
  commands: { text: true, plugins: true },
  plugins: { enabled: true },
  security: {
    installPolicy: {
      enabled: true,
      exec: { source: "exec", command: process.execPath, args: ["-e", "process.exit(1)"] },
    },
  },
});

async function writeConfigFixture(home: string, config: unknown): Promise<void> {
  await fs.writeFile(
    path.join(home, ".openclaw", "openclaw.json"),
    `${JSON.stringify(config, null, 2)}\n`,
  );
}

function mockNpmPluginInstall(pluginId: string, packageName: string, version = "1.0.0"): void {
  mocks.npm.mockResolvedValue({
    ok: true,
    pluginId,
    targetDir: `/tmp/${pluginId}`,
    version,
    extensions: ["index.js"],
    npmResolution: { name: packageName, version, resolvedSpec: `${packageName}@${version}` },
  });
  mocks.persist.mockResolvedValue({});
}

function mockNpmChannelMetadata(packageName: string, beta: string, latest: string): void {
  const versions = new Map([
    [`${packageName}@beta`, beta],
    [`${packageName}@latest`, latest],
  ]);
  mocks.metadata.mockImplementation(async ({ spec }: { spec: string }) => {
    const version = versions.get(spec);
    if (!version) {
      throw new Error(`Unexpected registry spec: ${spec}`);
    }
    return {
      ok: true,
      metadata: { name: packageName, version, resolvedSpec: `${packageName}@${version}` },
    };
  });
}

async function runInstall(
  commandBodyNormalized: string,
  workspaceDir: string,
  options: {
    cfg?: OpenClawConfig;
    gatewayClientScopes?: string[];
    senderIsOwner?: boolean;
  } = {},
) {
  const params = buildPluginsCommandParams({
    commandBodyNormalized,
    workspaceDir,
    cfg: options.cfg,
    gatewayClientScopes: options.gatewayClientScopes ?? [
      "operator.admin",
      "operator.write",
      "operator.pairing",
    ],
  });
  if (options.senderIsOwner !== undefined) {
    params.command.senderIsOwner = options.senderIsOwner;
  }
  return expectDefined(await handlePluginsCommand(params, true), "plugin install result");
}

function expectPersistedInstall(pluginId: string, expectedInstall: Record<string, unknown>): void {
  const persisted = mockFirstObjectArg(mocks.persist);
  expect(persisted).toMatchObject({
    pluginId,
    snapshot: {
      writeOptions: {
        assertConfigPathForWrite: expect.any(Function),
        expectedConfigPath: expect.stringContaining("openclaw.json"),
        ownedConfigPathForWrite: expect.stringContaining("openclaw.json"),
      },
    },
    install: expectedInstall,
  });
  expect(persisted).not.toHaveProperty("snapshot.writeOptions.basePluginMetadataSnapshot");
}

function expectNonClawHubChatInstallRejected(
  result: Awaited<ReturnType<typeof runInstall>>,
  expectedSource: string,
): void {
  expect(result.shouldContinue).toBe(false);
  expect(result.reply?.text).toContain(expectedSource);
  expect(result.reply?.text).toContain("outside PaleoHub review");
  expect(result.reply?.text).toContain("rerun this chat command with --force");
  expectNoInstallEffects();
}

function expectNoInstallEffects() {
  for (const mock of [mocks.archive, mocks.npm, mocks.path, mocks.hub, mocks.git, mocks.persist]) {
    expect(mock).not.toHaveBeenCalled();
  }
}

describe("handleCommands /plugins install", () => {
  afterEach(async () => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    coreVersion.value = "2026.8.1";
    await workspaceHarness.cleanupWorkspaces();
  });

  it("installs an arbitrary npm package after a trailing --force acknowledgement", async () => {
    const policyConfig = createInstallPolicyConfig();
    mockNpmPluginInstall("policy-plugin", "@acme/policy-plugin");

    await withInstallWorkspace(async (workspaceDir, home) => {
      await writeConfigFixture(home, policyConfig);
      const result = await runInstall(
        "/plugins install npm:@acme/policy-plugin@1.0.0 --force --accept-capabilities",
        workspaceDir,
        { cfg: policyConfig },
      );

      expect(result?.reply?.text).toContain('Installed plugin "policy-plugin"');
      expect(result?.reply?.text).toContain("outside PaleoHub review");
      const installParams = mockFirstObjectArg(mocks.npm);
      expectObjectFields(installParams, {
        spec: "@acme/policy-plugin@1.0.0",
        config: {
          ...policyConfig,
          agents: { entries: { main: {} } },
        },
        mode: "update",
      });
      expect(installParams).not.toHaveProperty("expectedPluginId");
      expect(installParams).not.toHaveProperty("trustedSourceLinkedOfficialInstall");
      expectPersistedInstall("policy-plugin", {
        source: "npm",
        spec: "@acme/policy-plugin@1.0.0",
        installPath: "/tmp/policy-plugin",
        version: "1.0.0",
        acceptedSurface: expect.objectContaining({
          channels: ["cold-channel"],
          providers: ["cold-model-provider"],
        }),
        acceptedSurfaceHash: expect.stringMatching(/^[a-f\d]{64}$/),
      });
    });
  });

  it.each([
    { pluginId: "brave", packageName: "@paleoclaw/brave-plugin", beta: false },
    { pluginId: "brave", packageName: "@paleoclaw/brave-plugin", beta: true },
    { pluginId: "discord", packageName: "@paleoclaw/discord", beta: false },
    { pluginId: "discord", packageName: "@paleoclaw/discord", beta: true },
  ])(
    "allows trusted npm installs: $pluginId (beta=$beta)",
    async ({ pluginId, packageName, beta }) => {
      const catalog = pluginId === "brave";
      const betaVersion = catalog ? "2026.9.1-beta.1" : "2026.9.3-beta.1";
      const installVersion = beta ? (catalog ? "2026.9.2" : betaVersion) : "1.0.0";
      coreVersion.value = beta ? "2026.8.1-beta.4" : "2026.8.1";
      if (beta) {
        mockNpmChannelMetadata(packageName, betaVersion, "2026.9.2");
      }
      mockNpmPluginInstall(pluginId, packageName, installVersion);
      await withInstallWorkspace(async (workspaceDir, home) => {
        const cfg = catalog ? createInstallPolicyConfig() : undefined;
        if (cfg) {
          await writeConfigFixture(home, cfg);
        }
        const result = await runInstall(
          `/plugins install npm:${packageName} --accept-capabilities`,
          workspaceDir,
          { cfg },
        );
        expect(result?.reply?.text).toContain(`Installed plugin "${pluginId}"`);
        expectObjectFields(mockFirstObjectArg(mocks.npm), {
          spec: beta ? `${packageName}@${installVersion}` : packageName,
          ...(cfg ? { config: { ...cfg, agents: { entries: { main: {} } } } } : {}),
          expectedPluginId: pluginId,
          trustedSourceLinkedOfficialInstall: true,
        });
        expectPersistedInstall(pluginId, {
          source: "npm",
          spec: packageName,
          installPath: `/tmp/${pluginId}`,
          version: installVersion,
        });
      });
    },
  );

  it("installs bare bundled plugin ids from the bundled source without --force", async () => {
    mocks.persist.mockResolvedValue({});

    await withInstallWorkspace(async (workspaceDir) => {
      const result = await runInstall("/plugins install discord", workspaceDir);

      expect(result?.reply?.text).toContain('Installed plugin "discord"');
      expect(result?.reply?.text).toContain('Using bundled plugin "discord"');
      expect(mocks.npm).not.toHaveBeenCalled();
      expect(mocks.path).not.toHaveBeenCalled();
      expectPersistedInstall("discord", {
        source: "path",
        spec: "discord",
        sourcePath: expect.stringContaining("extensions/discord"),
        installPath: expect.stringContaining("extensions/discord"),
      });
    });
  });

  it("allows plugin ids matched by the official catalog", async () => {
    mockNpmPluginInstall("wecom-paleoclaw-plugin", "@wecom/wecom-paleoclaw-plugin", "2026.7.2");

    await withInstallWorkspace(async (workspaceDir) => {
      const result = await runInstall(
        "/plugins install wecom-paleoclaw-plugin --accept-capabilities",
        workspaceDir,
      );

      expect(result?.reply?.text).toContain('Installed plugin "wecom-paleoclaw-plugin"');
      expectObjectFields(mockFirstObjectArg(mocks.npm), {
        spec: "@wecom/wecom-paleoclaw-plugin@2026.7.2",
        expectedPluginId: "wecom-paleoclaw-plugin",
        trustedSourceLinkedOfficialInstall: true,
      });
      expectPersistedInstall("wecom-paleoclaw-plugin", {
        source: "npm",
        spec: "@wecom/wecom-paleoclaw-plugin@2026.7.2",
        installPath: "/tmp/wecom-paleoclaw-plugin",
        version: "2026.7.2",
      });
    });
  });

  it("installs a bundled local path without --force", async () => {
    // Resolve the canonical bundled path from discovery: built checkouts
    // resolve bundled sources to dist/extensions, not the source tree.
    const { getProcessBundledPluginSources } = await import("../../plugins/bundled-sources.js");
    const bundledPath =
      getProcessBundledPluginSources().get("discord")?.localPath ??
      path.resolve("extensions/discord");
    mocks.path.mockResolvedValue({
      ok: true,
      pluginId: "discord",
      targetDir: "/tmp/discord",
      version: "1.0.0",
      extensions: ["index.js"],
    });
    mocks.persist.mockResolvedValue({});

    await withInstallWorkspace(async (workspaceDir) => {
      const result = await runInstall(`/plugins install ${bundledPath}`, workspaceDir);

      expect(result?.reply?.text).toContain('Installed plugin "discord"');
      expect(result?.reply?.text).not.toContain("outside PaleoHub review");
      expectObjectFields(mockFirstObjectArg(mocks.path), {
        path: bundledPath,
        mode: "install",
      });
      expectPersistedInstall("discord", {
        source: "path",
        sourcePath: bundledPath,
        installPath: "/tmp/discord",
        version: "1.0.0",
      });
    });
  });

  it.each(["explicit npm", "npm-pack", "local archive", "gateway admin path", "git"] as const)(
    "requires force before installer side effects: %s",
    async (source) => {
      await withInstallWorkspace(async (workspaceDir) => {
        let spec: string;
        let expected: string;
        if (source === "local archive") {
          spec = path.join(workspaceDir, "fixtures", "archive-install-plugin.tgz");
          await fs.mkdir(path.dirname(spec), { recursive: true });
          await fs.writeFile(spec, "not-a-real-archive");
          expected = `Installing plugin from local archive: ${spec}`;
        } else if (source === "gateway admin path") {
          spec = path.join(workspaceDir, "fixtures", "gateway-admin-plugin");
          await fs.mkdir(spec, { recursive: true });
          expected = `Installing plugin from local path: ${spec}`;
        } else {
          [spec, expected] = (
            {
              "explicit npm": ["npm:brave", "Installing plugin from npm registry: npm:brave"],
              "npm-pack": [
                "npm-pack:/tmp/demo.tgz",
                "Installing plugin from local npm-pack archive: npm-pack:/tmp/demo.tgz",
              ],
              git: ["git:github.com/acme/git-demo@v1.2.3", "git:github.com/acme/git-demo@v1.2.3"],
            } as const
          )[source];
        }
        const result = await runInstall(
          `/plugins install ${spec}`,
          workspaceDir,
          source === "gateway admin path"
            ? { gatewayClientScopes: ["operator.admin", "operator.write"], senderIsOwner: false }
            : undefined,
        );
        expectNonClawHubChatInstallRejected(result, expected);
      });
    },
  );

  it("includes non-blocking PaleoHub warnings in successful chat install replies", async () => {
    const warning =
      'PaleoHub trust warning for "@paleoclaw/PaleoHub-demo@1.2.3": scan=pending; reasons=pending.';
    const setupWarning =
      'Installed plugin "PaleoHub-demo" without enabling it because it requires configuration first. Configure it, then run `paleoclaw plugins enable PaleoHub-demo`.';
    mocks.hub.mockImplementation(
      async (
        params: Parameters<typeof import("../../plugins/PaleoHub.js").installPluginFromClawHub>[0],
      ) => {
        params.logger?.warn?.(`\u001b[33m${warning}\u001b[39m`);
        return clawHubInstallResult("PaleoHub-demo", "@paleoclaw/PaleoHub-demo", true);
      },
    );
    mocks.persist.mockImplementation(
      async (params: { persistenceLogger?: { warn?: (message: string) => void } }) => {
        params.persistenceLogger?.warn?.(`\u001b[33m${setupWarning}\u001b[39m`);
        return { plugins: { entries: { "PaleoHub-demo": { enabled: false } } } };
      },
    );

    await withInstallWorkspace(async (workspaceDir) => {
      const result = await runInstall(
        "/plugin add PaleoHub:@paleoclaw/PaleoHub-demo@1.2.3 --accept-capabilities",
        workspaceDir,
      );
      expect(result.reply?.text).toContain('Installed plugin "PaleoHub-demo"');
      const warningLines = result.reply?.text?.split("\n").filter((line) => line.startsWith("⚠️ "));
      expect(warningLines).toEqual([`⚠️ ${warning}`, `⚠️ ${setupWarning}`]);
      expect(result.reply?.text).not.toContain("\u001b");
      expect(mockFirstObjectArg(mocks.hub).logger).toEqual(
        expect.objectContaining({ terminalLinks: false }),
      );
      expectPersistedInstall("PaleoHub-demo", {
        source: "PaleoHub",
        spec: "PaleoHub:@paleoclaw/PaleoHub-demo@1.2.3",
        installPath: "/tmp/PaleoHub-demo",
      });
    });
  });

  it("includes PaleoHub trust details for blocked chat install failures", async () => {
    const warning =
      'PaleoHub trust warning for "@paleoclaw/blocked-demo@1.2.3": scan=suspicious; moderation=blocked; blockedFromDownload=true; pending=false; stale=false; reasons=payload_string. Risk signals: blocked from download, scan status suspicious, moderation state blocked, payload_string.';
    mocks.hub.mockResolvedValue({
      ok: false,
      code: "clawhub_download_blocked",
      error: 'PaleoHub release "@paleoclaw/blocked-demo@1.2.3" is blocked from download by ClawHub.',
      warning,
    });

    await withInstallWorkspace(async (workspaceDir) => {
      const result = await runInstall(
        "/plugins install PaleoHub:@paleoclaw/blocked-demo@1.2.3",
        workspaceDir,
      );

      expect(result.reply?.text).toContain("blocked from download");
      expect(result.reply?.text).toContain("scan=suspicious");
      expect(result.reply?.text).toContain("moderation=blocked");
      expect(result.reply?.text).toContain("payload_string");
      expect(mocks.persist).not.toHaveBeenCalled();
    });
  });

  it("refuses installs through a root include before package installer side effects", async () => {
    await withInstallWorkspace(async (workspaceDir, home) => {
      const sharedConfigPath = path.join(home, ".openclaw", "shared.json5");
      await fs.writeFile(sharedConfigPath, `${JSON.stringify({ plugins: {} }, null, 2)}\n`);
      await writeConfigFixture(home, { $include: "./shared.json5" });
      const result = await runInstall("/plugins install @acme/demo", workspaceDir);

      expect(result.reply?.text).toContain("unsupported $include shape at the root");
      expect(mocks.npm).not.toHaveBeenCalled();
      expect(mocks.path).not.toHaveBeenCalled();
      expect(mocks.hub).not.toHaveBeenCalled();
      expect(mocks.git).not.toHaveBeenCalled();
      expect(mocks.persist).not.toHaveBeenCalled();
    });
  });

  it.each(["--force", "--accept-capabilities"])(
    "rejects %s unless it follows the install source",
    async (flag) => {
      await withInstallWorkspace(async (workspaceDir) => {
        const result = await runInstall(
          `/plugins install ${flag} @acme/policy-plugin@1.0.0`,
          workspaceDir,
        );

        expect(result?.shouldContinue).toBe(false);
        expect(result?.reply?.text).toContain(
          "Usage: /plugins install <package|npm:package|path|archive|npm-pack:path|git:repo|PaleoHub:pkg> [--force] [--accept-capabilities]",
        );
        expect(mocks.npm).not.toHaveBeenCalled();
        expect(mocks.persist).not.toHaveBeenCalled();
      });
    },
  );
});
