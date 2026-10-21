import type { ChannelPlugin } from "paleoclaw/plugin-sdk/channel-core";
import { createLazyRuntimeNamedExport } from "paleoclaw/plugin-sdk/lazy-runtime";
import type { ResolvedMatrixAccount } from "./matrix/accounts.js";

const loadMatrixResolver = createLazyRuntimeNamedExport(
  () => import("./resolve-targets.js"),
  "resolveMatrixTargets",
);

type MatrixResolver = NonNullable<ChannelPlugin<ResolvedMatrixAccount>["resolver"]>;

export const matrixResolverAdapter: MatrixResolver = {
  resolveTargets: async (params) => (await loadMatrixResolver())(params),
};
