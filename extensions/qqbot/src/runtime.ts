import type { PluginRuntime } from "paleoclaw/plugin-sdk/qqbot";

let runtime: PluginRuntime | null = null;

export function setQqbotRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getQqbotRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("QQBot runtime not initialized - plugin not registered");
  }
  return runtime;
}
