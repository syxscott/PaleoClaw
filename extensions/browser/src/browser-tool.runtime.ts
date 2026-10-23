import { resolveOptionalIntegerOption } from "paleoclaw/plugin-sdk/number-runtime";
import { readRuntimeConfig as getRuntimeConfig } from "paleoclaw/plugin-sdk/runtime-config-snapshot";

export function resolveRuntimeImageSanitization(): { maxDimensionPx: number } | undefined {
  const maxDimensionPx = resolveOptionalIntegerOption(
    getRuntimeConfig().agents?.defaults?.imageMaxDimensionPx,
    { min: 1 },
  );
  if (maxDimensionPx === undefined) {
    return undefined;
  }
  return { maxDimensionPx };
}
