import { closeOpenClawStateDatabaseForTest } from "paleoclaw/plugin-sdk/channel-ingress-test-runtime";
import { closeOpenClawStateDatabaseAsync } from "paleoclaw/plugin-sdk/sqlite-runtime-testing";
import { botOpenIds } from "./monitor.state.js";

export async function cleanupFeishuMonitorStateForTests(): Promise<void> {
  botOpenIds.clear();
  await closeOpenClawStateDatabaseAsync();
  closeOpenClawStateDatabaseForTest();
}
