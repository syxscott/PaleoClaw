import "paleoclaw/plugin-sdk/compiled-subprocess-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("memory-lancedb startup imports", () => {
  afterEach(() => {
    vi.doUnmock("paleoclaw/plugin-sdk/agent-runtime");
    vi.doUnmock("paleoclaw/plugin-sdk/channel-actions");
    vi.resetModules();
  });

  it("loads the plugin entrypoint without broad SDK barrels", async () => {
    let broadImports = 0;
    const rejectBroadImport = () => {
      broadImports += 1;
      throw new Error("Memory startup must use focused SDK entrypoints");
    };
    vi.doMock("paleoclaw/plugin-sdk/agent-runtime", rejectBroadImport);
    vi.doMock("paleoclaw/plugin-sdk/channel-actions", rejectBroadImport);

    const pluginModule = await import("./index.js");

    expect(pluginModule.default.id).toBe("memory-lancedb");
    expect(broadImports).toBe(0);
  });
});
