import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  detectContextInjections,
  filterTrajectoryEvents,
  listTrajectoryKinds,
  readTrajectoryEvents,
  redactTrajectoryData,
  redactTrajectoryText,
} from "./trajectory.js";

describe("detectContextInjections", () => {
  it("detects the memory fence, the profile block and the auto-tool context", () => {
    const prompt = [
      "<paleoclaw-profile-context>",
      "## User Research Profile",
      "- Role: hydrologist",
      "</paleoclaw-profile-context>",
      "<paleoclaw-tools-context>",
      "- pbdb_query: result ready",
      "</paleoclaw-tools-context>",
      "<memory-context>",
      "remembered fact",
      "</memory-context>",
      "actual user question",
    ].join("\n");

    const injections = detectContextInjections(prompt);

    expect(injections.map((entry) => entry.source)).toEqual(["profile", "auto-tools", "memory"]);
    expect(injections[0]?.text).toContain("User Research Profile");
    expect(injections[2]?.text).toContain("remembered fact");
  });

  it("returns nothing for a plain prompt", () => {
    expect(detectContextInjections("just a question")).toEqual([]);
  });
});

describe("redactTrajectoryText", () => {
  it("strips API keys and bearer tokens", () => {
    const text = "key sk-abcdefghijklmnop1234 header Bearer abcdefghijklmnopqrstuvwx";

    const redacted = redactTrajectoryText(text);

    expect(redacted).not.toContain("sk-abcdefghijklmnop1234");
    expect(redacted).not.toContain("abcdefghijklmnopqrstuvwx");
  });

  it("strips authorization headers and api key assignments", () => {
    const text = 'Authorization: Bearer topsecretvalue12345 and apiKey: "another-secret-value"';

    const redacted = redactTrajectoryText(text);

    expect(redacted).not.toContain("topsecretvalue12345");
    expect(redacted).not.toContain("another-secret-value");
  });
});

describe("redactTrajectoryData", () => {
  it("strips image payloads", () => {
    const data = redactTrajectoryData({
      images: [{ type: "image", mimeType: "image/png", data: "QUJDRA==" }],
    }) as { images: Array<Record<string, unknown>> };

    expect(data.images[0]?.data).toBe("<redacted>");
    expect(data.images[0]?.bytes).toBe(4);
  });

  it("strips secrets nested in tool results", () => {
    const data = redactTrajectoryData({
      output: "token sk-abcdefghijklmnop1234",
    }) as { output: string };

    expect(data.output).not.toContain("sk-abcdefghijklmnop1234");
  });
});

describe("trajectory read side", () => {
  let dir = "";
  let filePath = "";

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "paleoclaw-trajectory-"));
    filePath = path.join(dir, "cache-trace.jsonl");
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("lists the event kinds present and filters by kind", async () => {
    const lines = [
      {
        ts: "2026-01-01T00:00:00.000Z",
        seq: 1,
        stage: "trajectory",
        kind: "system:stable",
        source: "system",
        text: "stable",
      },
      {
        ts: "2026-01-01T00:00:01.000Z",
        seq: 2,
        stage: "trajectory",
        kind: "user:prompt",
        source: "user",
        text: "question",
      },
      {
        ts: "2026-01-01T00:00:02.000Z",
        seq: 3,
        stage: "trajectory",
        kind: "assistant:text",
        source: "assistant",
        text: "answer",
      },
    ];
    // A legacy cache-trace line without a `kind` must not break the reader.
    await fs.writeFile(
      filePath,
      `${[...lines, { ts: "2026-01-01T00:00:03.000Z", seq: 4, stage: "prompt:before" }]
        .map((line) => JSON.stringify(line))
        .join("\n")}\n`,
      "utf8",
    );

    const events = await readTrajectoryEvents(filePath);

    expect(events).toHaveLength(3);
    expect(listTrajectoryKinds(events)).toEqual(["system:stable", "user:prompt", "assistant:text"]);
    const filtered = filterTrajectoryEvents(events, ["user:prompt", "assistant:text"]);
    expect(filtered.map((event) => event.kind)).toEqual(["user:prompt", "assistant:text"]);
  });

  it("returns an empty list for a missing file", async () => {
    expect(await readTrajectoryEvents(path.join(dir, "missing.jsonl"))).toEqual([]);
  });
});
