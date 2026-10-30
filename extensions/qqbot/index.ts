import type { ChannelPlugin, OpenClawPluginApi } from "paleoclaw/plugin-sdk/qqbot";
import { emptyPluginConfigSchema } from "paleoclaw/plugin-sdk/qqbot";
import { qqbotPlugin } from "./src/channel.js";
import { monitorQqbotProvider } from "./src/monitor.js";
import { probeQqbot } from "./src/probe.js";
import { setQqbotRuntime } from "./src/runtime.js";
import { sendMessageQqbot } from "./src/send.js";

export { monitorQqbotProvider } from "./src/monitor.js";
export { sendMessageQqbot } from "./src/send.js";
export { probeQqbot } from "./src/probe.js";
export { qqbotPlugin } from "./src/channel.js";

const plugin = {
  id: "qqbot",
  name: "QQ 机器人",
  description: "QQ open platform official bot channel plugin (WebSocket gateway)",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setQqbotRuntime(api.runtime);
    api.registerChannel({ plugin: qqbotPlugin as ChannelPlugin });
  },
};

export default plugin;
