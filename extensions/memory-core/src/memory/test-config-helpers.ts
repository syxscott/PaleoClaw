import type { OpenClawConfig } from "paleoclaw/plugin-sdk/memory-core-host-engine-foundation";

export function isolateMemoryManagerTestConfig(cfg: OpenClawConfig): OpenClawConfig {
  return {
    ...cfg,
    plugins: {
      ...cfg.plugins,
      enabled: cfg.plugins?.enabled ?? false,
    },
  };
}
