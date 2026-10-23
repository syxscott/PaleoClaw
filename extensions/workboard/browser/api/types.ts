import type { SessionRow } from "@paleoclaw/gateway-protocol";

export type { AgentsListResult } from "@paleoclaw/gateway-protocol";
export type GatewaySessionRow = SessionRow & {
  hasActiveRun?: boolean;
  abortedLastRun?: boolean;
};
