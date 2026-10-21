import { expect, it } from "vitest";
import { findSourceImportBackedges } from "../../../test/helpers/source-import-closure.js";

it("keeps database registration independent of schema and ownership operation runtimes", () => {
  expect(
    findSourceImportBackedges("src/cli/program/register.database.ts", [
      "src/state/paleoclaw-agent-schema-inspection.ts",
      "src/state/paleoclaw-database-preflight.ts",
      "src/state/paleoclaw-state-db-maintenance.ts",
      "src/state/paleoclaw-state-ownership-operations.ts",
      "src/state/paleoclaw-state-ownership.ts",
    ]),
  ).toEqual([]);
});
