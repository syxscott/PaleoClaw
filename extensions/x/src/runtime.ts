import type { PluginRuntime } from "paleoclaw/plugin-sdk/core";
import { createPluginRuntimeStore } from "paleoclaw/plugin-sdk/runtime-store";

const store = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "x",
  errorMessage: "X runtime not initialized",
});
export const getXRuntime = store.getRuntime;
export const setXRuntime = store.setRuntime;
