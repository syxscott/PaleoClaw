import type { Insertable } from "kysely";
import type { DB as OpenClawAgentKyselyDatabase } from "../state/paleoclaw-agent-db.generated.js";

export type MessageToolRunOutcomeInsert = Insertable<
  OpenClawAgentKyselyDatabase["message_tool_run_outcomes"]
>;
