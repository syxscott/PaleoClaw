import type { EngineConnection } from "../infra/sql-connection.js";
import { extractSqliteTableSchema } from "../infra/sqlite-schema-sql.js";
import type { OpenClawStateDatabaseOptions } from "./paleoclaw-state-db-contract.js";
import { runExistingOpenClawStateWriteTransaction } from "./paleoclaw-state-db-existing-write.js";
import type { OpenClawStateLeaseContext } from "./paleoclaw-state-lease-context.js";
import { getOpenClawDatabaseMaintenanceScope } from "./paleoclaw-state-maintenance-context.js";
import { OPENCLAW_STATE_SCHEMA_SQL } from "./paleoclaw-state-schema.js";

const existingAgentLeaseSchema = ["schema_meta", "state_leases", "agent_database_leases"]
  .map((table) =>
    extractSqliteTableSchema(OPENCLAW_STATE_SCHEMA_SQL, table, {
      endMarker: ") STRICT;",
      errorMessage: "Existing agent lease schema is unavailable.",
    }),
  )
  .join("\n");

export function withExistingAgentLeaseWrite<T>(
  maintenance: OpenClawStateLeaseContext,
  options: OpenClawStateDatabaseOptions,
  operation: (db: EngineConnection) => T,
): T {
  return runExistingOpenClawStateWriteTransaction(
    ({ db }) => {
      maintenance.assertOwnedInTransaction(db);
      const result = operation(db);
      maintenance.assertOwnedInTransaction(db);
      return result;
    },
    options,
    {
      operationLabel: "agent.database.maintenance.admission",
      schemaSql: existingAgentLeaseSchema,
      integrityCheck: getOpenClawDatabaseMaintenanceScope()?.sqliteIntegrityCheck,
      // Maintenance must drain published lease schemas before first-use provenance is added.
      schemaCompatibility: { allowedMissingColumns: ["agent_database_leases.provenance"] },
    },
  );
}
