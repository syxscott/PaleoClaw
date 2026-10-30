import { vi } from "vitest";
import { clearConfigCache } from "../config/config.js";
import { closeOpenClawAgentDatabasesForTest } from "../state/paleoclaw-agent-db.js";
import {
  closeOpenClawStateDatabaseAsync,
  closeOpenClawStateDatabaseForTest,
} from "../state/paleoclaw-state-db.js";
import { tempDirs } from "./setup-inference-activate.test-support.js";

export async function resetSetupInferenceState() {
  closeOpenClawAgentDatabasesForTest();
  await closeOpenClawStateDatabaseAsync();
  closeOpenClawStateDatabaseForTest();
  tempDirs.cleanup();
  clearConfigCache();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
}
