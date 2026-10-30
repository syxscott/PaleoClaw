import type { PluginRuntime } from "paleoclaw/plugin-sdk/weixin";

let runtime: PluginRuntime | null = null;

export function setWeixinRuntime(r: PluginRuntime): void {
  runtime = r;
}

export function getWeixinRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Weixin runtime not initialized - plugin not registered");
  }
  return runtime;
}
