import type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";
import type { OpenClawPluginToolContext } from "paleoclaw/plugin-sdk/plugin-entry";
import type { OpenClawPluginApi } from "paleoclaw/plugin-sdk/plugin-runtime";
import { createTestPluginApi } from "paleoclaw/plugin-sdk/plugin-test-api";
import tavilyPlugin from "../index.js";

export function captureTavilyTools(config: OpenClawConfig = {}) {
  const registeredTools = new Map<string, Parameters<OpenClawPluginApi["registerTool"]>[0]>();
  tavilyPlugin.register(
    createTestPluginApi({
      config,
      registerTool(tool, opts) {
        if (opts?.name) {
          registeredTools.set(opts.name, tool);
        }
      },
    }),
  );
  return (name: string, context: OpenClawPluginToolContext = { config }) => {
    const factory = registeredTools.get(name);
    if (typeof factory !== "function") {
      throw new Error("Expected Tavily tools to register as runtime-context factories");
    }
    const tool = factory(context);
    if (Array.isArray(tool) || !tool) {
      throw new Error("Expected single Tavily tool definitions");
    }
    return tool;
  };
}
