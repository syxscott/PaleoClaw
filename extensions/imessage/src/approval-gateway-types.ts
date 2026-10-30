import type { resolveApprovalOverGateway } from "paleoclaw/plugin-sdk/approval-gateway-runtime";

export type IMessageApprovalGatewayRuntime = NonNullable<
  Parameters<typeof resolveApprovalOverGateway>[0]["gatewayRuntime"]
>;
