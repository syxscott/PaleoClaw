import { definePluginEntry } from "paleoclaw/plugin-sdk/plugin-entry";
import { r2StorageProvider } from "./api.js";

export default definePluginEntry({
  id: "cloudflare",
  name: "Cloudflare",
  description: "Cloudflare R2 storage for named paleoclaw storage locations.",
  register(api) {
    api.registerStorageProvider(r2StorageProvider);
  },
});
