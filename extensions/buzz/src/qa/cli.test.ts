import { Command } from "commander";
import type { LiveTransportQaSuiteCommandOptions } from "paleoclaw/plugin-sdk/qa-runner-runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runLiveTransportQaSuiteCommand = vi.hoisted(() =>
  vi.fn<(params: LiveTransportQaSuiteCommandOptions) => Promise<void>>(async () => {}),
);

vi.mock("paleoclaw/plugin-sdk/qa-runner-runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("paleoclaw/plugin-sdk/qa-runner-runtime")>()),
  runLiveTransportQaSuiteCommand,
}));

import { buzzQaCliRegistration } from "./cli.js";

describe("Buzz QA CLI", () => {
  beforeEach(() => {
    runLiveTransportQaSuiteCommand.mockClear();
  });

  it("runs the portable canary and mention-gating scenarios", async () => {
    const qa = new Command();
    buzzQaCliRegistration.register(qa);

    expect(qa.commands.find((command) => command.name() === "buzz")?.helpInformation()).toMatch(
      /default: file with --credential-file; otherwise\s+shared environment/u,
    );

    await qa.parseAsync([
      "node",
      "paleoclaw",
      "buzz",
      "--provider-mode",
      "mock-openai",
      "--credential-file",
      "/secure/buzz-qa.json",
    ]);

    const params = runLiveTransportQaSuiteCommand.mock.calls[0]?.[0];
    expect(params).toMatchObject({
      channelId: "buzz",
      defaultProviderMode: "mock-openai",
      options: {
        providerMode: "mock-openai",
        credentialFile: "/secure/buzz-qa.json",
      },
    });
    expect(
      params?.selectScenarioIds({
        primaryModel: "openai/gpt-5.4",
        providerMode: "mock-openai",
      }),
    ).toEqual(["channel-canary", "channel-mention-gating"]);
  });

  it("forwards an explicitly selected thread follow-up scenario", async () => {
    const qa = new Command();
    buzzQaCliRegistration.register(qa);

    await qa.parseAsync([
      "node",
      "paleoclaw",
      "buzz",
      "--credential-file",
      "/secure/buzz-qa.json",
      "--scenario",
      "thread-follow-up",
    ]);

    const params = runLiveTransportQaSuiteCommand.mock.calls[0]?.[0];
    expect(
      params?.selectScenarioIds({
        primaryModel: "openai/gpt-5.4",
        providerMode: "mock-openai",
        scenarioIds: ["thread-follow-up"],
      }),
    ).toEqual(["thread-follow-up"]);
  });
});
