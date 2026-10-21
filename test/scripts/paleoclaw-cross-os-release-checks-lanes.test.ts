import { afterEach, expect, it, vi } from "vitest";
import type { LaneState } from "../../scripts/lib/cross-os-release-checks/config.ts";

const mocks = vi.hoisted(() => ({
  runInstalledCli: vi.fn(),
  runOpenClaw: vi.fn(),
}));

vi.mock("../../scripts/lib/cross-os-release-checks/installed.ts", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../scripts/lib/cross-os-release-checks/installed.ts")
  >()),
  runInstalledCli: mocks.runInstalledCli,
}));

vi.mock("../../scripts/lib/cross-os-release-checks/runtime.ts", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../scripts/lib/cross-os-release-checks/runtime.ts")
  >()),
  runOpenClaw: mocks.runOpenClaw,
}));

import { installLaneCompanions } from "../../scripts/lib/cross-os-release-checks/lane-companions.ts";

const lane: LaneState = {
  name: "fresh",
  rootDir: "/tmp/paleoclaw-release",
  prefixDir: "/tmp/paleoclaw-release/prefix",
  homeDir: "/tmp/paleoclaw-release/home",
  stateDir: "/tmp/paleoclaw-release/state",
  appDataDir: "/tmp/paleoclaw-release/app-data",
  gatewayPort: 18789,
  phaseTimings: [],
};
const companions = [
  { name: "@paleoclaw/codex", tarballPath: "/tmp/paleoclaw-codex.tgz" },
  { name: "@paleoclaw/discord", tarballPath: "/tmp/paleoclaw-discord.tgz" },
];
const env = { HOME: lane.homeDir };
const installArgs = ["plugins", "install"];
const success = { exitCode: 0, stdout: "", stderr: "" };
function install(cliPath?: string) {
  return installLaneCompanions({
    companions,
    logsDir: "/tmp/paleoclaw-release/logs",
    lane: { ...lane, phaseTimings: [] },
    env,
    ...(cliPath ? { cliPath } : {}),
  });
}

afterEach(() => vi.resetAllMocks());

it.each([
  { cliPath: undefined, runner: "packaged", supported: true },
  { cliPath: "/tmp/paleoclaw", runner: "installed", supported: false },
] as const)("probes capability consent once via $runner", async ({ cliPath, supported }) => {
  const runner = cliPath ? mocks.runInstalledCli : mocks.runOpenClaw;
  runner
    .mockResolvedValueOnce({
      ...success,
      stdout: supported ? "  --accept-capabilities  Accept declared capabilities\n" : "Usage\n",
    })
    .mockResolvedValue(success);

  await install(cliPath);
  const consent = supported ? ["--accept-capabilities"] : [];
  const expectedArgs = [
    [...installArgs, "--help"],
    ...companions.map(({ tarballPath }) =>
      installArgs.concat(`npm-pack:${tarballPath}`, "--force", consent),
    ),
  ];
  expect(runner.mock.calls).toEqual(
    expectedArgs.map((args) => [expect.objectContaining({ args, env })]),
  );
  expect(cliPath ? mocks.runOpenClaw : mocks.runInstalledCli).not.toHaveBeenCalled();
});

it("fails the lane when the help probe fails", async () => {
  mocks.runOpenClaw.mockRejectedValueOnce(new Error("help probe failed"));
  await expect(install()).rejects.toThrow("help probe failed");
  expect(mocks.runOpenClaw).toHaveBeenCalledTimes(1);
});
