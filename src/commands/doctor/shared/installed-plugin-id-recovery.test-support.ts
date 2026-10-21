import fs from "node:fs/promises";
import path from "node:path";
import type { OpenClawConfig } from "../../../config/types.openclaw.js";
import type { PluginInstallRecord } from "../../../config/types.plugins.js";
import { seedInstalledPluginIndex } from "../../../plugins/test-helpers/installed-plugin-index.js";
import type { OpenClawTestState } from "../../../test-utils/paleoclaw-test-state.js";

/** An already published official replacement, without invoking any installer. */
export async function seedRecoveryOwner(
  state: OpenClawTestState,
  config: OpenClawConfig,
  options: { version?: string; minHostVersion?: string; root?: string } = {},
) {
  const root = options.root ?? state.statePath("extensions", "paleoclaw-qqbot");
  const version = options.version ?? "2.0.3";
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, "index.js"), "module.exports = {};\n");
  await fs.writeFile(
    path.join(root, "openclaw.plugin.json"),
    JSON.stringify({
      id: "paleoclaw-qqbot",
      legacyPluginIds: ["qqbot"],
      configSchema: { type: "object" },
    }),
  );
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@tencent-connect/paleoclaw-qqbot",
      version,
      paleoclaw: {
        extensions: ["./index.js"],
        ...(options.minHostVersion ? { install: { minHostVersion: options.minHostVersion } } : {}),
      },
    }),
  );
  const records: Record<string, PluginInstallRecord> = {
    "paleoclaw-qqbot": {
      source: "npm",
      spec: `@tencent-connect/paleoclaw-qqbot@${version}`,
      resolvedName: "@tencent-connect/paleoclaw-qqbot",
      resolvedSpec: `@tencent-connect/paleoclaw-qqbot@${version}`,
      version,
      installPath: root,
    },
  };
  await seedInstalledPluginIndex(records, { config, env: state.env });
  return { root, records };
}
