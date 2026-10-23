import { AsyncLocalStorage } from "node:async_hooks";
import type { OpenClawStateLeaseContext } from "./paleoclaw-state-lease-context.js";

export const agentDatabaseMaintenanceAuthority = new AsyncLocalStorage<{
  authority: OpenClawStateLeaseContext;
  databasePath: string;
  assertScopeCurrent?: () => void;
}>();

/** Revalidate the held lease, including immediately before committing a versioned rebuild. */
export function assertAgentDatabaseMaintenanceAuthority(
  expected?: OpenClawStateLeaseContext,
): void {
  const authority = agentDatabaseMaintenanceAuthority.getStore()?.authority;
  if (!authority || (expected && authority !== expected)) {
    throw new Error(
      "Agent identity migration requires stopped-writer maintenance; stop active agents and run paleoclaw doctor --fix.",
    );
  }
  authority.assertOwned();
  agentDatabaseMaintenanceAuthority.getStore()?.assertScopeCurrent?.();
}
