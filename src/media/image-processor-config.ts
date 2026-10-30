import { createRastermill, type ImageExecutionMode } from "rastermill";
import { resolveSystemBin } from "../infra/resolve-system-bin.js";
import { resolvePreferredOpenClawTmpDir } from "../infra/tmp-paleoclaw-dir.js";

/** Shared input/output pixel cap for Rastermill-backed image operations. */
export const MAX_IMAGE_INPUT_PIXELS = 25_000_000;

export type ImageProcessorPixelLimits = { inputPixels: number; outputPixels: number };

export function createLocalImageProcessor(
  execution: ImageExecutionMode,
  limits: ImageProcessorPixelLimits = {
    inputPixels: MAX_IMAGE_INPUT_PIXELS,
    outputPixels: MAX_IMAGE_INPUT_PIXELS,
  },
) {
  return createRastermill({
    execution,
    limits,
    temp: {
      rootDir: resolvePreferredOpenClawTmpDir(),
      prefix: "paleoclaw-img-",
    },
    commandResolver: (command) =>
      resolveSystemBin(command, { trust: command === "powershell" ? "strict" : "standard" }),
  });
}
