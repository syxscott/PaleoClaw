import { describe, expect, it } from "vitest";
import { buildBackupArchivePath } from "./backup-shared.js";

describe("Windows namespace backup archive paths", () => {
  const agent =
    "root/payload/windows/C/Users/Eric/.openclaw/agents/main/agent/paleoclaw-agent.sqlite";

  it.each([
    [String.raw`C:\Users\Eric\.openclaw\agents\main\agent\paleoclaw-agent.sqlite`, agent],
    [String.raw`\\?\C:\Users\Eric\.openclaw\agents\main\agent\paleoclaw-agent.sqlite`, agent],
    ["//./C:/Users/Eric/.openclaw/agents/main/agent/paleoclaw-agent.sqlite", agent],
    [
      String.raw`\\?\UNC\server\share\paleoclaw-agent.sqlite`,
      "root/payload/posix/server/share/paleoclaw-agent.sqlite",
    ],
    [
      String.raw`\\server\share\paleoclaw-agent.sqlite`,
      "root/payload/posix/server/share/paleoclaw-agent.sqlite",
    ],
    [
      String.raw`\\?\Volume{00000000-0000-0000-0000-000000000001}\agent.sqlite`,
      "root/payload/posix/?/Volume{00000000-0000-0000-0000-000000000001}/agent.sqlite",
    ],
  ])("encodes %s as one portable payload path", (sourcePath, expected) => {
    expect(buildBackupArchivePath("root", sourcePath)).toBe(expected);
  });
});
