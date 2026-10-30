import type { OpenClawPluginApi } from "paleoclaw/plugin-sdk/plugin-entry";

export {
  buildPluginConfigSchema,
  definePluginEntry,
  type AnyAgentTool,
  type OpenClawPluginApi,
  type OpenClawPluginToolContext,
  type PluginLogger,
} from "paleoclaw/plugin-sdk/plugin-entry";
export type { PluginStateKeyedStore } from "paleoclaw/plugin-sdk/plugin-state-runtime";
export { createPluginRuntimeStore, type PluginRuntime } from "paleoclaw/plugin-sdk/runtime-store";

export type PluginGatewayAccessAuthority = NonNullable<
  ReturnType<Parameters<OpenClawPluginApi["registerGatewayAccessPolicy"]>[0]["authorize"]>
>;
