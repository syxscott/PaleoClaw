import { openOpenClawAgentDatabase } from "../../state/paleoclaw-agent-db.js";
import { OpenClawTestState, withOpenClawTestState } from "../../test-utils/paleoclaw-test-state.js";

export function transcriptScope(env: NodeJS.ProcessEnv, sessionId: string, storePath: string) {
  return { agentId: "main", env, sessionId, sessionKey: `agent:main:${sessionId}`, storePath };
}

export function withTranscriptDatabase<T>(
  sessionId: string,
  run: (fixture: {
    state: OpenClawTestState;
    database: ReturnType<typeof openOpenClawAgentDatabase>;
    scope: ReturnType<typeof transcriptScope>;
  }) => Promise<T>,
) {
  return withOpenClawTestState({ scenario: "minimal" }, (state) => {
    const database = openOpenClawAgentDatabase({ agentId: "main", env: state.env });
    return run({ state, database, scope: transcriptScope(state.env, sessionId, database.path) });
  });
}
