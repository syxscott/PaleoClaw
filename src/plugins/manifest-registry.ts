import type { OpenClawConfig } from "../config/types.openclaw.js";
import type { PluginInstallRecord } from "../config/types.plugins.js";
import { getGatewayPluginMetadataSnapshot } from "./current-plugin-metadata-state.js";
import type { PluginCandidate } from "./discovery.types.js";
import { loadInstalledPluginIndexInstallRecordsSync } from "./installed-plugin-index-record-reader.js";
import {
  buildPluginManifestRegistry,
  type PluginManifestRegistryBuildParams,
} from "./manifest-registry-build.js";
import type { PluginManifestRegistry } from "./manifest-registry.types.js";
import type { PluginDiagnostic } from "./manifest-types.js";

export type {
  BundledChannelConfigCollector,
  PluginManifestContractListKey,
  PluginManifestRecord,
  PluginManifestRegistry,
} from "./manifest-registry.types.js";

/**
 * Discovery-backed registry read. Unlike the core reader this always performs
 * discovery, so callers that need the on-disk plugin set (for example skill
 * directory resolution) do not observe the cached gateway snapshot instead.
 */
export function loadPluginManifestRegistry(params: {
  config?: OpenClawConfig;
  workspaceDir?: string;
  cache?: boolean;
  env?: NodeJS.ProcessEnv;
  candidates?: PluginCandidate[];
  diagnostics?: PluginDiagnostic[];
}): PluginManifestRegistry {
  const env = params.env ?? process.env;
  let installRecords: Record<string, PluginInstallRecord> | undefined;
  return buildPluginManifestRegistry({
    ...params,
    env,
    getInstallRecords: () =>
      (installRecords ??= loadInstalledPluginIndexInstallRecordsSync({ env })),
  });
}

export function loadPluginManifestRegistryCore(
  params: Omit<PluginManifestRegistryBuildParams, "getInstallRecords"> & {
    installRecords?: Record<string, PluginInstallRecord>;
  } = {},
): PluginManifestRegistry {
  // Explicit candidates belong to startup/install inspection. Ordinary runtime
  // readers use the boot descriptors, including when config policy changes.
  if (!params.candidates && !params.discovery && !params.installRecords) {
    const gatewaySnapshot = getGatewayPluginMetadataSnapshot();
    if (gatewaySnapshot) {
      return gatewaySnapshot.manifestRegistry;
    }
  }
  const env = params.env ?? process.env;
  let installRecords = params.installRecords;
  return buildPluginManifestRegistry({
    ...params,
    env,
    // Candidate validation can finish without consulting persisted state. Keep
    // acquisition lazy and shared by discovery, trust and duplicate precedence.
    getInstallRecords: () =>
      (installRecords ??= loadInstalledPluginIndexInstallRecordsSync({ env })),
  });
}
