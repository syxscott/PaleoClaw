import type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";
import { isDiagnosticFlagEnabled } from "paleoclaw/plugin-sdk/diagnostic-flags";

const PROFILER_FLAGS = ["profiler", "codex.profiler"] as const;

export function isCodexAppServerProfilerEnabled(
  config?: OpenClawConfig,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return PROFILER_FLAGS.some((flag) => isDiagnosticFlagEnabled(flag, config, env));
}
