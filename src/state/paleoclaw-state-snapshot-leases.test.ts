import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import * as tar from "tar";
import { expect, it } from "vitest";
import { buildBackupArchivePath } from "../commands/backup-shared.js";
import { assertDoctorAgentLeaseAdmission } from "../commands/doctor-agent-lease-refusal.js";
import { createBackupArchive } from "../infra/backup-create.js";
import { createVerifiedSqliteSnapshot } from "../infra/sqlite-snapshot.js";
import { createOpenClawSnapshotCopy } from "../snapshot/paleoclaw-snapshot-copy.js";
import { withOpenClawTestState } from "../test-utils/paleoclaw-test-state.js";
import { openOpenClawAgentDatabase } from "./paleoclaw-agent-db.js";
import { openOpenClawStateDatabase } from "./paleoclaw-state-db.js";
import { sanitizeOpenClawStateLeaseRows } from "./paleoclaw-state-snapshot-sanitizer.js";

it.each(["private canary", "SQLite snapshot", "archive"] as const)(
  "%s permits copied-state maintenance while retaining the live source lease",
  async (kind) => {
    await withOpenClawTestState({ scenario: "minimal" }, async (state) => {
      const agent = openOpenClawAgentDatabase({ agentId: "main", env: state.env });
      const source = openOpenClawStateDatabase({ env: state.env });
      const sourceLeases = source.db.prepare("SELECT * FROM agent_database_leases").all();
      expect(sourceLeases).toEqual([
        expect.objectContaining({ agent_id: "main", path: agent.path, owner_pid: process.pid }),
      ]);
      await expect(assertDoctorAgentLeaseAdmission(state.env)).rejects.toThrow(
        "An agent database is in use",
      );
      const copiedStateDir = state.path("copy");
      let copyPath = path.join(copiedStateDir, "state", "openclaw.sqlite");
      await fs.mkdir(path.dirname(copyPath), { recursive: true });
      if (kind === "private canary") {
        // The deployer copies first, then asks the candidate's lease-only owner
        // to prepare that isolated image without applying archive queue policy.
        await createVerifiedSqliteSnapshot({ sourcePath: source.path, targetPath: copyPath });
        const copy = new DatabaseSync(copyPath);
        try {
          copy.exec("BEGIN IMMEDIATE");
          sanitizeOpenClawStateLeaseRows(copy);
          copy.exec("COMMIT");
        } finally {
          copy.close();
        }
      } else if (kind === "SQLite snapshot") {
        await createOpenClawSnapshotCopy({
          database: { path: source.path, identity: { role: "global" } },
          targetPath: copyPath,
        });
      } else {
        const archive = await createBackupArchive({
          output: state.path("backup.tar.gz"),
          includeWorkspace: false,
        });
        await tar.x({ file: archive.archivePath, cwd: copiedStateDir });
        copyPath = path.join(
          copiedStateDir,
          buildBackupArchivePath(archive.archiveRoot, source.path),
        );
      }
      const copyEnv = {
        ...state.env,
        OPENCLAW_STATE_DIR: path.dirname(path.dirname(copyPath)),
      };
      await expect(assertDoctorAgentLeaseAdmission(copyEnv)).resolves.toBeUndefined();
      expect(source.db.prepare("SELECT * FROM agent_database_leases").all()).toEqual(sourceLeases);
      expect(agent.db.isOpen).toBe(true);
      await expect(assertDoctorAgentLeaseAdmission(state.env)).rejects.toThrow(
        "An agent database is in use",
      );
    });
  },
);
