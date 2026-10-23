// Signal test support owns cleanup for process-global plugin runtime state.
import type { PluginRuntime } from "paleoclaw/plugin-sdk/core";
import { createPluginRuntimeStore } from "paleoclaw/plugin-sdk/runtime-store";

const { clearRuntime } = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "signal",
  errorMessage: "Signal runtime not initialized",
});

export function clearSignalRuntimeForTest(): void {
  clearRuntime();
}
