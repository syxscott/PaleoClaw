import type { Selectable } from "kysely";
import type { DB as OpenClawStateKyselyDatabase } from "../../../state/paleoclaw-state-db.generated.js";

export type SubagentRunSqliteRow = Selectable<OpenClawStateKyselyDatabase["subagent_runs"]>;
