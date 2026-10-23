import { defineBundledChannelSetupEntry } from "paleoclaw/plugin-sdk/channel-entry-contract";

export default defineBundledChannelSetupEntry({
  importMetaUrl: import.meta.url,
  plugin: {
    specifier: "./setup-plugin-api.js",
    exportName: "zalouserSetupPlugin",
  },
});
