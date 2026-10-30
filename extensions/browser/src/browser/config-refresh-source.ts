import type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";
import {
  readRuntimeConfig as getRuntimeConfig,
  getRuntimeConfigSourceSnapshot,
} from "paleoclaw/plugin-sdk/runtime-config-snapshot";

export function loadBrowserConfigForRuntimeRefresh(): OpenClawConfig {
  return getRuntimeConfigSourceSnapshot() ?? getRuntimeConfig();
}
