/**
 * Browser test-support re-exports from shared plugin-sdk test fixtures.
 */
export {
  createCliRuntimeCapture,
  expectGeneratedTokenPersistedToGatewayAuth,
  type CliRuntimeCapture,
} from "paleoclaw/plugin-sdk/test-fixtures";
export { createTempHomeEnv, useAutoCleanupTempDirTracker } from "paleoclaw/plugin-sdk/test-env";
export { isLiveTestEnabled } from "paleoclaw/plugin-sdk/test-live";
export type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";
