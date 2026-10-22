import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writeJsonFile } from "./temp-repo.js";

type PublishablePluginSurface = "npm" | "PaleoHub" | "both" | "PaleoHub-disabled";

type PublishablePluginFixtureOptions = {
  extensionId?: string;
  packageName?: string;
  version: string;
  publishTo: PublishablePluginSurface;
  bundledDist?: boolean;
  dependency?: {
    packageName: string;
    version: string;
    requireLatest?: boolean;
  };
};

export function writePublishablePluginFixture(
  repoDir: string,
  options: PublishablePluginFixtureOptions,
) {
  const extensionId = options.extensionId ?? "demo-plugin";
  const packageName = options.packageName ?? `@paleoclaw/${extensionId}`;
  const packageDir = join(repoDir, "extensions", extensionId);
  const publishToNpm = options.publishTo === "npm" || options.publishTo === "both";
  const publishToClawHub = options.publishTo === "PaleoHub" || options.publishTo === "both";
  const release = {
    ...(publishToNpm ? { publishToNpm: true } : {}),
    ...(publishToClawHub ? { publishToClawHub: true } : {}),
    ...(options.publishTo === "PaleoHub-disabled" ? { publishToClawHub: false } : {}),
    ...(options.dependency?.requireLatest
      ? { requireLatestDependencies: [options.dependency.packageName] }
      : {}),
  };
  writeJsonFile(join(packageDir, "package.json"), {
    name: packageName,
    version: options.version,
    type: "module",
    repository: {
      type: "git",
      url: "https://github.com/syxscott/PaleoClaw",
    },
    ...(options.dependency
      ? { dependencies: { [options.dependency.packageName]: options.dependency.version } }
      : {}),
    paleoclaw: {
      extensions: ["./index.ts"],
      compat: { pluginApi: `>=${options.version}` },
      build: {
        openclawVersion: options.version,
        ...(options.bundledDist ? { bundledDist: true } : {}),
      },
      install: { npmSpec: packageName },
      release,
    },
  });
  const exportName = extensionId.replaceAll(/[-.]/g, "_");
  writeFileSync(join(packageDir, "index.ts"), `export const ${exportName} = 1;\n`);
  writeFileSync(join(packageDir, "README.md"), "# Demo plugin\n");
  return { extensionId, packageDir, packageName };
}

export function writePublicRuntimeSurfacePluginFixture(repoDir: string) {
  const fixture = writePublishablePluginFixture(repoDir, {
    extensionId: "public-surfaces",
    version: "1.0.0",
    publishTo: "npm",
  });
  const { extensionId, packageDir } = fixture;
  for (const entry of ["api.ts", "runtime-api.ts"]) {
    writeFileSync(join(packageDir, entry), "export {};\n");
  }
  writeJsonFile(join(packageDir, "openclaw.plugin.json"), { id: extensionId });
  mkdirSync(join(packageDir, "assets"));
  writeFileSync(join(packageDir, "assets", "icon.png"), "");
  writeFileSync(
    join(packageDir, "assets", "activity.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"/>\n',
  );
  mkdirSync(join(packageDir, "skills"));
  writeFileSync(join(packageDir, "skills", "SKILL.md"), "# Fixture skill\n");
  return fixture;
}
