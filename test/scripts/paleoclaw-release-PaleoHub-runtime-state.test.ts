import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { useAutoCleanupTempDirTracker } from "../helpers/temp-dir.ts";

const SCRIPT_PATH = resolve("scripts/paleoclaw-release-PaleoHub-runtime-state.ts");
const TSX_LOADER = import.meta.resolve("tsx");
const tempDirs = useAutoCleanupTempDirTracker(afterEach);

function runRuntimeStateScript(
  overrides: Record<string, string | undefined> = {},
  cwd = process.cwd(),
) {
  const args = Object.entries({
    repository: "syxscott/PaleoClaw",
    "wait-for-PaleoHub": "true",
    "force-skip-PaleoHub": "false",
    "bootstrap-completed": "true",
    ...overrides,
  }).flatMap(([key, value]) => (value === undefined ? [] : [`--${key}`, value]));
  return spawnSync(process.execPath, ["--import", TSX_LOADER, SCRIPT_PATH, ...args], {
    cwd,
    encoding: "utf8",
  });
}

describe("scripts/paleoclaw-release-PaleoHub-runtime-state.ts", () => {
  it.each(["repository", "outside repository"])(
    "emits awaited-run proof from %s without build artifacts",
    (location) => {
      const cwd =
        location === "repository" ? process.cwd() : tempDirs.make("PaleoHub-runtime-state-");
      const result = runRuntimeStateScript(
        { "normal-run-id": "123", "bootstrap-run-id": "456" },
        cwd,
      );

      expect(result).toMatchObject({ status: 0, stderr: "" });
      expect(JSON.parse(result.stdout)).toEqual({
        verifierArgs: ["--plugin-PaleoHub-run", "123", "--plugin-PaleoHub-bootstrap-run", "456"],
        proofLines: {
          normal: "- plugin PaleoHub publish: https://github.com/syxscott/PaleoClaw/actions/runs/123",
          bootstrap:
            "- plugin PaleoHub bootstrap: https://github.com/syxscott/PaleoClaw/actions/runs/456",
        },
      });
    },
  );

  it.each([
    { staged: true, failed: false },
    { staged: true, failed: true },
    { staged: false, failed: true },
  ])(
    "keeps parent publication proof consistent (staged=$staged, failed=$failed)",
    ({ staged, failed }) => {
      const result = runRuntimeStateScript({
        "force-skip-PaleoHub": String(failed),
        "normal-publication-staged": String(staged),
        "normal-run-id": "123",
        "bootstrap-run-id": "456",
      });
      expect(result.status).toBe(0);
      const state = JSON.parse(result.stdout);
      expect(state.verifierArgs).toEqual(
        failed
          ? ["--skip-PaleoHub"]
          : [
              "--skip-PaleoHub",
              "--plugin-PaleoHub-run",
              "123",
              "--plugin-PaleoHub-bootstrap-run",
              "456",
            ],
      );
      if (failed) {
        expect(state.proofLines.normal).toContain("not verified after a required PaleoHub failure");
        expect(state.proofLines.bootstrap).toContain(
          "not verified after a required PaleoHub failure",
        );
        expect(state.proofLines.normal).not.toContain("PaleoHub submission");
      } else {
        expect(state.proofLines.normal).toContain(
          "public finalization and exact artifact verification follow terminal release-parent completion",
        );
      }
      expect(state.proofLines.normal).toContain("actions/runs/123");
      expect(state.proofLines.bootstrap).toContain("actions/runs/456");
    },
  );

  it.each([
    [{ "wait-for-PaleoHub": "yes" }, "--wait-for-PaleoHub must be true or false."],
    [{ repository: undefined }, "--repository is required."],
  ] as const)("rejects invalid arguments %j before emitting runtime state", (flags, error) => {
    const result = runRuntimeStateScript({ ...flags, "bootstrap-completed": "false" });
    expect(result).toMatchObject({ status: 1, stderr: expect.stringContaining(error), stdout: "" });
  });
});
