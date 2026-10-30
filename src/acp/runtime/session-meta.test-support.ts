import { closeOpenClawAgentDatabasesAsync } from "../../state/paleoclaw-agent-db.js";
import { closeOpenClawStateDatabaseAsync } from "../../state/paleoclaw-state-db.js";
import { withTestDir } from "../../test-helpers/temp-dir.js";

/** Settle retained worker leases before removing the fixture's database files. */
export async function withAcpSessionTestDir<T>(
  options: Parameters<typeof withTestDir>[0],
  run: (dir: string) => Promise<T>,
): Promise<T> {
  return await withTestDir(options, async (dir) => {
    try {
      return await run(dir);
    } finally {
      await closeOpenClawAgentDatabasesAsync();
      await closeOpenClawStateDatabaseAsync();
    }
  });
}
