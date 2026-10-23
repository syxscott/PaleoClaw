import { isBundleCapabilitySupported } from "./bundle-capability-support.js";
import type { PluginBundleFormat } from "./manifest-types.js";

type PluginArtifactFormat = "paleoclaw" | PluginBundleFormat;

export const PLUGIN_ARTIFACT_ADAPTER_IDENTITY = "paleoclaw/v1" as const;

export type PluginInstallArtifactInspection = {
  format: PluginArtifactFormat;
  mapped: string[];
  unavailable: string[];
};

export function inspectNativePluginArtifact(): PluginInstallArtifactInspection {
  return { format: "paleoclaw", mapped: ["plugin"], unavailable: [] };
}

export function inspectBundlePluginArtifact(params: {
  format: PluginBundleFormat;
  capabilities: Iterable<string>;
}): PluginInstallArtifactInspection {
  const capabilities = [...new Set(params.capabilities)].toSorted();
  return {
    format: params.format,
    mapped: capabilities.filter((capability) =>
      isBundleCapabilitySupported(params.format, capability),
    ),
    unavailable: capabilities.filter(
      (capability) => !isBundleCapabilitySupported(params.format, capability),
    ),
  };
}
