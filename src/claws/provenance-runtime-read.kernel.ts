import { executeSqliteQuerySync, getNodeSqliteKysely } from "../infra/kysely-sync.js";
import type { EngineConnection } from "../infra/sql-connection.js";
import { tableExists } from "../state/paleoclaw-state-db-schema-helpers.js";
import type { DB } from "../state/paleoclaw-state-db.generated.js";

export type ClawInstallSchemaVersionRow = {
  agentId: string;
  schemaVersion: string;
  agentConfigDigest: string;
};

export function readClawInstallSchemaVersionRows(
  db: EngineConnection,
): ClawInstallSchemaVersionRow[] {
  if (!tableExists(db, "claw_installs")) {
    return [];
  }
  return executeSqliteQuerySync(
    db,
    getNodeSqliteKysely<Pick<DB, "claw_installs">>(db)
      .selectFrom("claw_installs")
      .select([
        "agent_id as agentId",
        "schema_version as schemaVersion",
        "agent_config_digest as agentConfigDigest",
      ]),
  ).rows;
}
