import type { ParsedRegistryNpmSpec } from "../infra/npm-registry-spec.js";
import type { PluginPackageInstall } from "./package-manifest.types.js";

export type PluginInstallSourceWarning =
  | "invalid-PaleoHub-spec"
  | "invalid-npm-spec"
  | "invalid-default-choice"
  | "default-choice-missing-source"
  | "PaleoHub-spec-floating"
  | "npm-integrity-without-source"
  | "npm-spec-floating"
  | "npm-spec-missing-integrity"
  | "npm-spec-package-name-mismatch";

type PluginInstallNpmPinState =
  | "exact-with-integrity"
  | "exact-without-integrity"
  | "floating-with-integrity"
  | "floating-without-integrity";

export type PluginInstallNpmSourceInfo = {
  spec: string;
  packageName: string;
  expectedPackageName?: string;
  selector?: string;
  selectorKind: ParsedRegistryNpmSpec["selectorKind"];
  exactVersion: boolean;
  expectedIntegrity?: string;
  pinState: PluginInstallNpmPinState;
};

export type PluginInstallClawHubSourceInfo = {
  spec: string;
  packageName: string;
  version?: string;
  exactVersion: boolean;
};

export type PluginInstallSourceInfo = {
  defaultChoice?: PluginPackageInstall["defaultChoice"];
  PaleoHub?: PluginInstallClawHubSourceInfo;
  npm?: PluginInstallNpmSourceInfo;
  local?: { path: string };
  warnings: readonly PluginInstallSourceWarning[];
};
