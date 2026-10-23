import { resolveOpenClawAgentSqlitePath } from "paleoclaw/plugin-sdk/sqlite-runtime";
import { resolveStateDir } from "paleoclaw/plugin-sdk/state-paths";

export function captureMemoryAgentDatabaseOptions(agentId: string) {
  const env = { ...process.env, OPENCLAW_STATE_DIR: resolveStateDir() };
  return { agentId, env, path: resolveOpenClawAgentSqlitePath({ agentId, env }) };
}

export function captureMemoryAgentReadTarget(
  options: Parameters<typeof resolveOpenClawAgentSqlitePath>[0],
) {
  return {
    agentId: options.agentId,
    databasePath: resolveOpenClawAgentSqlitePath(options),
    stateDir: resolveStateDir(options.env),
  };
}
