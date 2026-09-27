import type { OpenClawPluginApi } from "paleoclaw/plugin-sdk/weixin";
import { emptyPluginConfigSchema } from "paleoclaw/plugin-sdk/weixin";
import { createWeixinPlugin } from "./src/channel.js";
import { setWeixinRuntime } from "./src/runtime.js";

export { createWeixinPlugin } from "./src/channel.js";
export { qrLogin, buildSendMessagePayload, getUpdates } from "./src/ilink.js";
export { ContextTokenStore } from "./src/context-tokens.js";
export { normalizeWeixinMessage, extractTextFromItems, guessChatType } from "./src/normalize.js";
export { splitTextForDelivery, wrapCopyFriendlyLines } from "./src/text.js";
export {
  aes128EcbEncrypt,
  aes128EcbDecrypt,
  parseAesKey,
  buildImageItem,
  buildFileItem,
} from "./src/media.js";

const plugin = {
  id: "weixin",
  name: "微信 WeChat",
  description:
    "WeChat personal-account bridge via Tencent's iLink bot HTTP API (QR login + long-poll)",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setWeixinRuntime(api.runtime);
    api.registerChannel({ plugin: createWeixinPlugin() });
  },
};

export default plugin;
