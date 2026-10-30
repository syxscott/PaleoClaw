import type { PluginRuntime } from "paleoclaw/plugin-sdk/core";
import { createPluginRuntimeStore } from "paleoclaw/plugin-sdk/runtime-store";

const {
  getRuntime: getIMessageRuntime,
  setRuntime: setIMessageRuntime,
  tryGetRuntime: getOptionalIMessageRuntime,
} = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "imessage",
  errorMessage: "iMessage runtime not initialized",
});
export { getIMessageRuntime, getOptionalIMessageRuntime, setIMessageRuntime };
