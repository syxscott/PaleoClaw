import { defineBundledChannelSetupEntry } from "paleoclaw/plugin-sdk/channel-entry-contract";

export default defineBundledChannelSetupEntry({
  importMetaUrl: import.meta.url,
  plugin: {
    specifier: "./api.js",
    exportName: "synologyChatPlugin",
  },
});
