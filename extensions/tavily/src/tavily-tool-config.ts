import type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";
import type { OpenClawPluginToolContext } from "paleoclaw/plugin-sdk/plugin-entry";
import type { OpenClawPluginApi } from "paleoclaw/plugin-sdk/plugin-runtime";

export type TavilyToolConfigContext = Pick<
  OpenClawPluginToolContext,
  "config" | "runtimeConfig" | "getRuntimeConfig"
>;

export function resolveTavilyToolConfig(
  api: OpenClawPluginApi,
  ctx?: TavilyToolConfigContext,
): OpenClawConfig {
  return ctx?.getRuntimeConfig?.() ?? ctx?.runtimeConfig ?? ctx?.config ?? api.config;
}
