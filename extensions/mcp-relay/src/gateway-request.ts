import type { GatewayIngressPrincipalBindingV1 } from "paleoclaw/plugin-sdk/gateway-ingress";

export type GatewayRequest = (
  ...args: Parameters<GatewayIngressPrincipalBindingV1["request"]>
) => Promise<unknown>;
