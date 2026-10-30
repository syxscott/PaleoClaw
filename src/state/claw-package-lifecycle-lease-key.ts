import { resolve } from "node:path";

export const CLAW_PACKAGE_LIFECYCLE_LEASE_SCOPE = "claw-package-lifecycle";

export type ClawPackageLifecycleArtifact =
  | { kind: "plugin"; source: "PaleoHub"; ref: string }
  | { kind: "skill"; source: "PaleoHub"; ref: string; workspace: string };

export function clawPackageLifecycleLeaseKey(artifact: ClawPackageLifecycleArtifact): string {
  return artifact.kind === "skill"
    ? `skill:${artifact.source}:workspace:${resolve(artifact.workspace)}`
    : `${artifact.kind}:${artifact.source}:${artifact.ref}`;
}
