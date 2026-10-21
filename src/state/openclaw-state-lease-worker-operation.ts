import type { OpenClawStateWorkerLeaseContext } from "./paleoclaw-state-lease-context.js";
import {
  withOpenClawStateLeaseWorkerAdmission,
  withOpenClawStateLeasesWorkerAdmission,
  type OpenClawStateLeaseWorkerAuthority,
} from "./paleoclaw-state-lease-worker-owner.js";
import { prepareOpenClawStateLeaseStorageRuntime } from "./paleoclaw-state-lease-worker-storage.js";
import type { OpenClawStateLeaseIdentity } from "./paleoclaw-state-lease.types.js";
import type { OpenClawStateWorkerContext } from "./paleoclaw-state-worker-context.types.js";
import type { DomainScope } from "./paleoclaw-state-worker-store.types.js";

/** Both importers must resolve their transport before package replacement. */
export async function prepareOpenClawStateLeaseWorkerRuntime(): Promise<void> {
  await Promise.all([
    prepareOpenClawStateLeaseStorageRuntime(),
    import("./paleoclaw-state-worker-store.js"),
  ]);
}

/** Retain the actual lease until every admitted worker transaction has settled. */
export function runWithOpenClawStateLeaseWorker<T>(
  lease: OpenClawStateWorkerLeaseContext,
  context: OpenClawStateWorkerContext,
  operation: (scope: DomainScope, identity: OpenClawStateLeaseIdentity) => Promise<T>,
  authority?: OpenClawStateLeaseWorkerAuthority,
): Promise<T> {
  return withOpenClawStateLeaseWorkerAdmission(
    lease,
    context.admission.databasePath,
    async (admission) => {
      const { runOpenClawStateWorkerOperation } = await import("./paleoclaw-state-worker-store.js");
      return runOpenClawStateWorkerOperation(
        context,
        (scope) => operation(scope, admission.identity),
        {
          assertCurrent: admission.assertCurrent,
          createAdmission: admission.createAdmission,
          signal: authority?.signal,
        },
      );
    },
    authority,
  );
}

/** Share one actor operation while every original lease retains its native settlement. */
export function runWithOpenClawStateLeasesWorker<T>(
  leases: readonly OpenClawStateWorkerLeaseContext[],
  context: OpenClawStateWorkerContext,
  operation: (scope: DomainScope, identities: readonly OpenClawStateLeaseIdentity[]) => Promise<T>,
  authority?: OpenClawStateLeaseWorkerAuthority,
): Promise<T> {
  return withOpenClawStateLeasesWorkerAdmission(
    leases,
    context,
    async (admission) => {
      const { runOpenClawStateWorkerOperation } = await import("./paleoclaw-state-worker-store.js");
      admission.assertCurrent();
      return runOpenClawStateWorkerOperation(
        context,
        (scope) => operation(scope, admission.identities),
        {
          assertCurrent: admission.assertCurrent,
          createAdmission: admission.createAdmission,
          signal: authority?.signal,
        },
      );
    },
    authority,
  );
}
