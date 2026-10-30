import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockProcessPlatform } from "../test-utils/vitest-spies.js";
import { normalizeWindowsArgv } from "./windows-argv.js";

const nodePath = "C:\\Program Files\\nodejs\\node.exe";
const scriptPath = "C:\\pkg\\paleoclaw.mjs";

describe("normalizeWindowsArgv", () => {
  beforeEach(() => {
    mockProcessPlatform("win32");
  });
  afterEach(() => vi.restoreAllMocks());

  it("preserves non-launcher arguments containing node.exe", () => {
    expect(
      normalizeWindowsArgv([
        "paleoclaw",
        nodePath,
        scriptPath,
        "agent",
        "--message",
        "debug node.exe-wrapper startup",
      ]),
    ).toEqual(["paleoclaw", scriptPath, "agent", "--message", "debug node.exe-wrapper startup"]);
  });

  it("preserves node.exe as the first user argument after the script entry", () => {
    expect(normalizeWindowsArgv([nodePath, scriptPath, "node.exe", "--help"])).toEqual([
      nodePath,
      scriptPath,
      "node.exe",
      "--help",
    ]);
  });

  it("preserves a post-script node.exe argument after normalizing a duplicated prefix", () => {
    expect(normalizeWindowsArgv([nodePath, nodePath, scriptPath, "node.exe", "--help"])).toEqual([
      nodePath,
      scriptPath,
      "node.exe",
      "--help",
    ]);
  });

  it("does not normalize POSIX argv", () => {
    const argv = ["/usr/bin/node", "/opt/paleoclaw/paleoclaw.mjs", "node.exe", "--help"];
    expect(normalizeWindowsArgv(argv, { platform: "linux" })).toBe(argv);
  });
});
