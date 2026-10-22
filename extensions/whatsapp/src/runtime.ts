import type { PluginRuntime } from "paleoclaw/plugin-sdk/core";
import { createPluginRuntimeStore } from "paleoclaw/plugin-sdk/runtime-store";

const runtimeStore = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "whatsapp",
  errorMessage: "WhatsApp runtime not initialized",
});
const setWhatsAppRuntime = runtimeStore.setRuntime;
const getWhatsAppRuntime = runtimeStore.getRuntime;
const getOptionalWhatsAppRuntime = runtimeStore.tryGetRuntime;
// A registry reload may require reconnecting; keep lookups on the injected runtime.
const getOptionalWhatsAppChannelRuntime = () => getOptionalWhatsAppRuntime()?.channel;
const getWhatsAppChannelRuntime = () => {
  const channel = getOptionalWhatsAppChannelRuntime();
  if (!channel) {
    throw new Error("WhatsApp channel runtime not initialized");
  }
  return channel;
};

export {
  getOptionalWhatsAppChannelRuntime,
  getOptionalWhatsAppRuntime,
  getWhatsAppChannelRuntime,
  getWhatsAppRuntime,
  setWhatsAppRuntime,
};
