import { createSqliteWorkerWriteAdmission } from "../infra/sqlite-worker-store.js";
import type { StateSchemaPublicationBlocker } from "./paleoclaw-state-schema-publication.js";
import { captureOpenClawStateWorkerContext } from "./paleoclaw-state-worker-context.js";
import { runOpenClawStateWorkerOperation } from "./paleoclaw-state-worker-store.js";

/** Publish deferred schema metadata through the existing shared-state writer. */
export function reconcileOpenClawStateSchemaPublicationAsync(
  options: { path?: string; env?: NodeJS.ProcessEnv; signal?: AbortSignal } = {},
): Promise<StateSchemaPublicationBlocker | undefined> {
  const context = captureOpenClawStateWorkerContext(options);
  return runOpenClawStateWorkerOperation(
    context,
    (scope) => scope.execute({ type: "database.publishSchema", input: undefined }),
    {
      existingOnly: true,
      signal: options.signal,
      createAdmission: createSqliteWorkerWriteAdmission(context.admission.assertCurrent, [
        context.admission.databasePath,
      ]),
    },
  );
}
