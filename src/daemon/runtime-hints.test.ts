import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          OPENCLAW_STATE_DIR: "/tmp/paleoclaw-state",
          OPENCLAW_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "paleoclaw-gateway",
        windowsTaskName: "paleoclaw Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /tmp/paleoclaw-state/logs/gateway.log",
      "Launchd stderr (if installed): /tmp/paleoclaw-state/logs/gateway.err.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        systemdServiceName: "paleoclaw-gateway",
        windowsTaskName: "paleoclaw Gateway",
      }),
    ).toEqual(["Logs: journalctl --user -u paleoclaw-gateway.service -n 200 --no-pager"]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        systemdServiceName: "paleoclaw-gateway",
        windowsTaskName: "paleoclaw Gateway",
      }),
    ).toEqual(['Logs: schtasks /Query /TN "paleoclaw Gateway" /V /FO LIST']);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "paleoclaw gateway install",
        startCommand: "paleoclaw gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.paleoclaw.gateway.plist",
        systemdServiceName: "paleoclaw-gateway",
        windowsTaskName: "paleoclaw Gateway",
      }),
    ).toEqual([
      "paleoclaw gateway install",
      "paleoclaw gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.paleoclaw.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "paleoclaw gateway install",
        startCommand: "paleoclaw gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.paleoclaw.gateway.plist",
        systemdServiceName: "paleoclaw-gateway",
        windowsTaskName: "paleoclaw Gateway",
      }),
    ).toEqual([
      "paleoclaw gateway install",
      "paleoclaw gateway",
      "systemctl --user start paleoclaw-gateway.service",
    ]);
  });
});
