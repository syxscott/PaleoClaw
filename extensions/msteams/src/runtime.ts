import { createPluginRuntimeStore } from "paleoclaw/plugin-sdk/runtime-store";
import type { PluginRuntime } from "paleoclaw/plugin-sdk/runtime-store";

const {
  setRuntime: setMSTeamsRuntime,
  getRuntime: getMSTeamsRuntime,
  tryGetRuntime: getOptionalMSTeamsRuntime,
} = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "msteams",
  errorMessage: "MSTeams runtime not initialized",
});
export { getMSTeamsRuntime, getOptionalMSTeamsRuntime, setMSTeamsRuntime };
