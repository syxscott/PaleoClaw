import { requireNativeDatabaseFile } from "../infra/database-engine/physical-facts.js";
import { isPostgresSqlConnection, type EngineConnection } from "../infra/sql-connection.js";
import { getSqliteWorkerStateIntegrityAdmission } from "../infra/sqlite-worker-state-context.js";
import { assertExistingOpenClawStateRuntimeSchema } from "./paleoclaw-state-db-existing-schema.js";
import type { OpenClawStateIntegrityPolicy } from "./paleoclaw-state-db-integrity-admission.js";
import {
  assertSupportedStateSchemaVersion,
  type StateSchemaContentVersionRowReader,
} from "./paleoclaw-state-db-schema-version.js";

export function assertStateReadSchemaForPolicy(
  database: EngineConnection,
  pathname: string,
  existingSchema: boolean,
  integrityPolicy?: OpenClawStateIntegrityPolicy,
  readContentVersionRow?: StateSchemaContentVersionRowReader,
): void {
  if (isPostgresSqlConnection(database)) {
    if (integrityPolicy !== undefined) {
      requireNativeDatabaseFile("postgres", "integrity");
    }
    assertSupportedStateSchemaVersion(database, pathname, undefined, readContentVersionRow);
    return;
  }
  if (existingSchema) {
    assertExistingOpenClawStateRuntimeSchema(
      database,
      pathname,
      getSqliteWorkerStateIntegrityAdmission(),
      integrityPolicy,
    );
  } else {
    assertSupportedStateSchemaVersion(database, pathname, undefined, readContentVersionRow);
  }
}
