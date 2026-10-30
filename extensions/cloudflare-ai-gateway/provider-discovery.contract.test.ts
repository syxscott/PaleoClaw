// Cloudflare Ai Gateway tests cover provider discovery.contract plugin behavior.
import { describeCloudflareAiGatewayProviderDiscoveryContract } from "paleoclaw/plugin-sdk/provider-test-contracts";

describeCloudflareAiGatewayProviderDiscoveryContract(() => import("./index.js"));
