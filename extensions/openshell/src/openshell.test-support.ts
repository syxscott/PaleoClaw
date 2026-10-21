import type { CreateSandboxBackendParams } from "paleoclaw/plugin-sdk/sandbox";
import {
  createSandboxBrowserConfig,
  createSandboxPruneConfig,
  createSandboxSshConfig,
} from "paleoclaw/plugin-sdk/test-fixtures";

export function createOpenShellBackendSandboxConfig(): CreateSandboxBackendParams["cfg"] {
  return {
    mode: "all",
    backend: "openshell",
    scope: "session",
    workspaceAccess: "rw",
    workspaceRoot: "/tmp/paleoclaw-sandboxes",
    dockerTmpfsSource: "configured",
    docker: {
      image: "paleoclaw-sandbox:bookworm-slim",
      containerPrefix: "paleoclaw-sbx-",
      workdir: "/workspace",
      readOnlyRoot: false,
      tmpfs: [],
      network: "none",
      capDrop: [],
      binds: [],
      env: {},
    },
    ssh: createSandboxSshConfig("/tmp/paleoclaw-sandboxes"),
    browser: createSandboxBrowserConfig(),
    tools: { allow: ["*"], deny: [] },
    prune: createSandboxPruneConfig(),
  };
}

export function createOpenShellRuntimeEntryFixture(runtimeId: string, configLabel = "paleoclaw") {
  return {
    containerName: runtimeId,
    backendId: "openshell",
    runtimeLabel: runtimeId,
    sessionKey: "agent:main",
    createdAtMs: 1,
    lastUsedAtMs: 1,
    image: configLabel,
    configLabelKind: "Source",
  } as const;
}
