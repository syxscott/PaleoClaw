import type { PluginRuntime } from "paleoclaw/plugin-sdk/channel-core";
import { createPluginRuntimeStore } from "paleoclaw/plugin-sdk/runtime-store";

export const {
  setRuntime: setDiscordRuntime,
  tryGetRuntime: getOptionalDiscordRuntime,
  getRuntime: getDiscordRuntime,
} = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "discord",
  errorMessage: "Discord runtime not initialized",
});
