import { readDatabasePathIdentitySync } from "../../infra/sqlite-worker-identity.js";
import type { OpenClawAgentDatabaseOptions } from "../../state/paleoclaw-agent-db-contract.js";
import { toAgentExecutionConstraints } from "../../state/paleoclaw-agent-execution-scope.js";
import { captureOpenClawAgentDatabaseExecution } from "../../state/paleoclaw-agent-execution.js";

/** Pin an existing inode before preparation yields; the executor owns first creation. */
export function captureAuthProfileWriteExecution(
  target: OpenClawAgentDatabaseOptions & { path: string },
) {
  const identity = readDatabasePathIdentitySync(target.path);
  return captureOpenClawAgentDatabaseExecution(
    target,
    identity.key.startsWith("file:") ? toAgentExecutionConstraints(identity) : {},
  );
}
