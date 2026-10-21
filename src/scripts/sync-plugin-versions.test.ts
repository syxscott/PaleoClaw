// Plugin version sync tests cover script updates to plugin package versions.
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncPluginVersions } from "../../scripts/sync-plugin-versions.js";
import { useAutoCleanupTempDirTracker } from "../../test/helpers/temp-dir.js";

const tempDirs = useAutoCleanupTempDirTracker(afterEach);

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("syncPluginVersions", () => {
  it("preserves workspace paleoclaw devDependencies and plugin host floors", () => {
    const rootDir = tempDirs.make("paleoclaw-sync-plugin-versions-");

    writeJson(path.join(rootDir, "package.json"), {
      name: "paleoclaw",
      version: "2026.4.1",
    });
    writeJson(path.join(rootDir, "packages/ai/package.json"), {
      name: "@paleoclaw/ai",
      version: "2026.3.30",
    });
    writeJson(path.join(rootDir, "packages/llm-core/package.json"), {
      name: "@paleoclaw/llm-core",
      version: "0.0.0-private",
      private: true,
    });
    writeJson(path.join(rootDir, "extensions/imessage/package.json"), {
      name: "@paleoclaw/imessage",
      version: "2026.3.30",
      devDependencies: {
        paleoclaw: "workspace:*",
      },
      peerDependencies: {
        paleoclaw: ">=2026.3.30",
      },
      paleoclaw: {
        install: {
          minHostVersion: ">=2026.3.30",
        },
        compat: {
          pluginApi: ">=2026.3.30",
        },
        build: {
          openclawVersion: "2026.3.30",
        },
      },
    });

    const summary = syncPluginVersions(rootDir);
    const updatedPackage: unknown = JSON.parse(
      fs.readFileSync(path.join(rootDir, "extensions/imessage/package.json"), "utf8"),
    );

    expect(summary.updated).toContain("@paleoclaw/imessage");
    expect(summary.updated).toContain("@paleoclaw/ai");
    expect(summary.updated).not.toContain("@paleoclaw/llm-core");
    expect(
      JSON.parse(fs.readFileSync(path.join(rootDir, "packages/ai/package.json"), "utf8")),
    ).toMatchObject({ version: "2026.4.1" });
    expect(
      JSON.parse(fs.readFileSync(path.join(rootDir, "packages/llm-core/package.json"), "utf8")),
    ).toMatchObject({ private: true, version: "0.0.0-private" });
    expect(updatedPackage).toMatchObject({
      version: "2026.4.1",
      devDependencies: { paleoclaw: "workspace:*" },
      peerDependencies: { paleoclaw: ">=2026.4.1" },
      paleoclaw: {
        install: { minHostVersion: ">=2026.3.30" },
        compat: { pluginApi: ">=2026.4.1" },
        build: { openclawVersion: "2026.4.1" },
      },
    });
  });

  it.each([
    ["2026.9.5", ">=2026.9.4", ">=2026.9.5"],
    ["2026.9.5", ">=2026.9.5", ">=2026.9.5"],
    ["2026.9.5", ">=2026.9.6", ">=2026.9.6"],
    ["2026.9.5", ">=2026.9.10", ">=2026.9.10"],
    ["2026.9.5", ">=2026.8.0", ">=2026.9.5"],
    ["2026.9.5-beta.2", ">=2026.9.5-beta.1", ">=2026.9.5-beta.2"],
    ["2026.9.5-beta.2", ">=2026.9.5-beta.10", ">=2026.9.5-beta.10"],
    ["2026.9.5-beta.2", ">=2026.9.5", ">=2026.9.5"],
    ["2026.9.5", ">=2026.9.5-1", ">=2026.9.5-1"],
    ["2026.9.5-1", ">=2026.9.5", ">=2026.9.5-1"],
    ["2026.9.5", ">=2026.9.5-rc.1", ">=2026.9.5"],
    ["2026.9.5", ">=2026.9.6-rc.1", ">=2026.9.6-rc.1"],
    ["2026.9.5", ">=2026.9.5.beta.1", ">=2026.9.5.beta.1"],
  ])("syncs release %s API and peer floors %s to %s", (version, current, expected) => {
    const rootDir = tempDirs.make("paleoclaw-sync-plugin-api-floor-");
    const packagePath = path.join(rootDir, "extensions/example/package.json");
    const pkg = {
      name: "@paleoclaw/example",
      version,
      peerDependencies: { paleoclaw: current },
      paleoclaw: { compat: { pluginApi: current } },
    };
    writeJson(path.join(rootDir, "package.json"), { name: "paleoclaw", version });
    writeJson(packagePath, pkg);

    const updated = current === expected ? [] : [pkg.name];
    expect(syncPluginVersions(rootDir, { write: false }).updated).toEqual(updated);
    expect(JSON.parse(fs.readFileSync(packagePath, "utf8"))).toEqual(pkg);
    expect(syncPluginVersions(rootDir).updated).toEqual(updated);
    expect(JSON.parse(fs.readFileSync(packagePath, "utf8"))).toEqual({
      ...pkg,
      peerDependencies: { paleoclaw: expected },
      paleoclaw: { compat: { pluginApi: expected } },
    });
  });

  it("reports pending version sync without writing in check mode", () => {
    const rootDir = tempDirs.make("paleoclaw-sync-plugin-versions-check-");

    writeJson(path.join(rootDir, "package.json"), {
      name: "paleoclaw",
      version: "2026.4.2",
    });
    writeJson(path.join(rootDir, "extensions/discord/package.json"), {
      name: "@paleoclaw/discord",
      version: "2026.4.1",
      peerDependencies: {
        paleoclaw: ">=2026.4.1",
      },
      paleoclaw: {
        compat: {
          pluginApi: ">=2026.4.1",
        },
      },
    });

    const summary = syncPluginVersions(rootDir, { write: false });
    const unchangedPackage: unknown = JSON.parse(
      fs.readFileSync(path.join(rootDir, "extensions/discord/package.json"), "utf8"),
    );

    expect(summary.updated).toEqual(["@paleoclaw/discord"]);
    expect(unchangedPackage).toMatchObject({
      version: "2026.4.1",
      peerDependencies: { paleoclaw: ">=2026.4.1" },
      paleoclaw: { compat: { pluginApi: ">=2026.4.1" } },
    });
  });

  it("uses the base release version for beta changelog entries", () => {
    const rootDir = tempDirs.make("paleoclaw-sync-plugin-versions-beta-changelog-");

    writeJson(path.join(rootDir, "package.json"), {
      name: "paleoclaw",
      version: "2026.5.3-beta.1",
    });
    writeJson(path.join(rootDir, "extensions/matrix/package.json"), {
      name: "@paleoclaw/matrix",
      version: "2026.5.3-beta.1",
    });
    fs.mkdirSync(path.join(rootDir, "extensions/matrix"), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, "extensions/matrix/CHANGELOG.md"),
      "# Changelog\n\n## 2026.5.2\n\n### Changes\n\n- Previous release.\n",
      "utf8",
    );

    const summary = syncPluginVersions(rootDir);
    const changelog = fs.readFileSync(path.join(rootDir, "extensions/matrix/CHANGELOG.md"), "utf8");

    expect(summary.changelogged).toEqual(["@paleoclaw/matrix"]);
    expect(changelog).toContain("## 2026.5.3\n\n### Changes\n- Version alignment");
    expect(changelog).not.toContain("## 2026.5.3-beta.1");

    const checkSummary = syncPluginVersions(rootDir, { write: false });

    expect(checkSummary.changelogged).toStrictEqual([]);
  });
});
