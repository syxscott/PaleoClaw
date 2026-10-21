import { createPluginRuntimeStore } from "paleoclaw/plugin-sdk/runtime-store";
import type { PluginRuntime } from "paleoclaw/plugin-sdk/runtime-store";

const { setRuntime: setQaChannelRuntime, getRuntime: getQaChannelRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "qa-channel",
    errorMessage: "QA channel runtime not initialized",
  });

export { getQaChannelRuntime, setQaChannelRuntime };
