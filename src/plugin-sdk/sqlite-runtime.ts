// Narrow SQLite schema, path, and transaction helpers for first-party runtime.

export type { Generated, Selectable } from "kysely";
export { runQueuedStoreWrite, type StoreWriterQueue } from "../shared/store-writer-queue.js";
export { hasSqliteWorkerOutcomeUnknown } from "../infra/sqlite-worker-contract.js";
export {
  openSqliteWorkerStore,
  runSqliteWorkerStoreOperation,
  runSqliteWorkerStoreWrite,
  SqliteWorkerError,
  type SqliteWorkerBackend,
  type SqliteWorkerCommand,
  type SqliteWorkerOperations,
  type SqliteWorkerStore,
} from "../infra/sqlite-worker-store.js";
export { requestSqliteWorkerOperationAdmission } from "../infra/sqlite-worker-operation-admission.js";
export {
  readSqliteDatabaseScopedWriteTokenForPath,
  readSqliteDatabaseWriteTokenForPath,
} from "../infra/sqlite-database-admission.js";
export {
  openOpenClawAgentSqliteWorkerStore,
  openOpenClawAgentSqliteWorkerStoreV2,
  type OpenClawAgentSqliteWorkerStore,
  type OpenClawAgentSqliteWorkerAuthorityV2,
  type OpenClawAgentSqliteWorkerStoreV2,
} from "../state/paleoclaw-agent-worker-store.js";

export {
  ensureOpenClawAgentDatabaseSchema,
  resolveOpenClawAgentSqlitePath,
} from "../state/paleoclaw-agent-db.js";
export { withOpenClawAgentDatabaseReadOnly } from "../state/paleoclaw-agent-db-readonly.js";
export { withFreshOpenClawAgentDatabaseReadOnly } from "../state/paleoclaw-agent-db-readonly-open.js";
export { readOpenClawAgentDatabaseIdentity } from "../state/paleoclaw-agent-db-identity.js";
export {
  captureOpenClawAgentDatabaseExecution,
  supportsOpenClawAgentDatabaseExecution,
} from "../state/paleoclaw-agent-execution.js";
export type { OpenClawAgentDatabaseExecution } from "../state/paleoclaw-agent-execution-contract.js";
export { assertOpenClawAgentDatabaseForMaintenance } from "../state/paleoclaw-agent-db-maintenance.js";
export { ensureOpenClawAgentStandingIntentsSchema } from "../state/paleoclaw-agent-standing-intents-schema.js";
export {
  compileSqliteQueryBindings,
  enableNodeSqliteKyselyStatementCache,
  sqliteStringSet,
} from "../infra/kysely-sync.js";
export { resolveExistingSqliteFileUri } from "../infra/node-sqlite.js";
export { withSqliteReadOnlyInspection } from "../infra/sqlite-maintenance-inspection.js";
export {
  prepareSqliteReadOnlyLocation,
  prepareSqliteReadOnlyLocationSync,
} from "../infra/sqlite-snapshot-source.js";
export { assertTransactionUsable } from "../infra/sqlite-transaction.js";
export {
  borrowOpenClawAgentDatabase,
  executeSqliteQuerySync,
  executeSqliteQueryTakeFirstSync,
  getNodeSqliteKysely,
  iterateSqliteQuerySync,
  openNodeSqliteDatabase,
  openOpenClawAgentDatabase,
  prepareSqliteQuerySync,
  runOpenClawAgentWriteAdmission,
  runSqliteImmediateTransaction,
  runSqliteImmediateTransactionSync,
  withOpenClawAgentDatabaseAsync,
  withOpenClawAgentDatabaseWrite,
} from "./sqlite-runtime-legacy.js";
export { tableExists } from "../state/paleoclaw-state-db-schema-helpers.js";
