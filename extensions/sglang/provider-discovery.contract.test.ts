import { describeSglangProviderDiscoveryContract } from "paleoclaw/plugin-sdk/provider-test-contracts";

describeSglangProviderDiscoveryContract({
  load: () => import("./index.js"),
});
