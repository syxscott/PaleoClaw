import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withTestDir } from "../test-helpers/temp-dir.js";
import { createPnpmTarget, writePackageRoot } from "./package-update-steps.test-support.js";
import { swapStagedPackageInstall } from "./package-update-swap.js";
import { prepareNativePackageStage } from "./update-native-package-stage.js";

describe("native launcher publication", () => {
  it.each([false, true])(
    "commits with an actionable warning only for missing launcher targets (missing=%s)",
    async (missing) => {
      await withTestDir({ prefix: "native-launcher-publication-" }, async (base) => {
        const project = path.join(base, "global");
        const globalRoot = path.join(project, "v11");
        const packageRoot = path.join(globalRoot, "group", "node_modules", "paleoclaw");
        const binDir = path.join(base, "bin");
        await writePackageRoot(packageRoot, "1.0.0");
        await fs.mkdir(binDir);
        const installTarget = createPnpmTarget(globalRoot, packageRoot);
        const native = await prepareNativePackageStage({
          installTarget,
          packageName: "paleoclaw",
          installSpec: "paleoclaw@2.0.0",
          globalBinDir: binDir,
          env: {},
        });
        if (!native) {
          throw new Error("missing native stage");
        }
        const candidate = path.join(native.projectRoot, path.relative(project, packageRoot));
        await writePackageRoot(candidate, "2.0.0");
        const entry = path.join(candidate, "paleoclaw.mjs");
        await fs.writeFile(entry, 'console.log("candidate");\n');
        const target = path.relative(
          native.binDir,
          missing ? path.join(base, ".openclaw-update-native-removed", "paleoclaw.mjs") : entry,
        );
        // All published formats must inspect the executable path, even with correct metadata.
        for (const [name, content] of [
          ["paleoclaw", `exec node "$basedir_abs/${target}" "$@"`],
          ["paleoclaw.cmd", `"node" "%~dp0\\${target.replaceAll("/", "\\")}" %*`],
          ["paleoclaw.ps1", `& "node" "$basedir/${target}" $args`],
        ]) {
          await fs.writeFile(
            path.join(native.binDir, name!),
            `${content}\n# cmd-shim-target=${entry}\n`,
          );
        }
        const result = await swapStagedPackageInstall({
          installTarget,
          packageName: "paleoclaw",
          stage: {
            prefix: native.projectRoot,
            layout: {
              prefix: native.projectRoot,
              globalRoot: native.globalRoot,
              binDir: native.binDir,
            },
            packageRoot: candidate,
            installTarget: createPnpmTarget(native.globalRoot, candidate),
            native,
          },
        });
        expect(result).toMatchObject({ status: "committed", step: { exitCode: 0 } });
        if (missing) {
          expect(result.step.warnings).toHaveLength(3);
          for (const name of ["paleoclaw", "paleoclaw.cmd", "paleoclaw.ps1"]) {
            expect(result.step.warnings).toContainEqual(
              expect.stringContaining(path.join(binDir, name)),
            );
          }
          expect(result.step.advisory).toMatchObject({
            kind: "recoverable-maintenance",
            message: expect.stringContaining("Reinstall the current paleoclaw version with pnpm"),
          });
        } else {
          expect(result.step.warnings).toBeUndefined();
        }
        expect(await fs.readFile(path.join(packageRoot, "paleoclaw.mjs"), "utf8")).toContain(
          "candidate",
        );
      });
    },
  );
});
