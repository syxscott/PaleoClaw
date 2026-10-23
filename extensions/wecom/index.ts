import type { OpenClawPluginApi } from "paleoclaw/plugin-sdk/wecom";
import { emptyPluginConfigSchema } from "paleoclaw/plugin-sdk/wecom";
import { createWecomPlugin } from "./src/channel.js";
import { setWecomRuntime } from "./src/runtime.js";

export { createWecomPlugin } from "./src/channel.js";
export { WxBizMsgCrypt, sha1Signature } from "./src/crypto.js";
export { parseXmlEnvelope, buildXmlEnvelope } from "./src/xml.js";
export { parseWecomMessage } from "./src/normalize.js";
export {
  buildTextMessagePayload,
  buildMarkdownMessagePayload,
  sendWecomMessage,
  splitContentByBytes,
  truncateContent,
} from "./src/qyapi.js";

const plugin = {
  id: "wecom",
  name: "企业微信 WeCom",
  description: "WeCom (企业微信) self-built app channel: encrypted callback + QYAPI send",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setWecomRuntime(api.runtime);
    api.registerChannel({ plugin: createWecomPlugin() });
  },
};

export default plugin;
