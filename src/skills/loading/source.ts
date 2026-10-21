import { normalizeOptionalString } from "@paleoclaw/normalization-core/string-coerce";
import type { SkillTelemetrySource } from "../types.js";
import type { Skill } from "./skill-contract.js";

/** Returns the stable source label attached to a loaded skill. */
export function resolveSkillSource(skill: Partial<Pick<Skill, "source" | "sourceInfo">>): string {
  return (
    normalizeOptionalString(skill.source) ??
    normalizeOptionalString(skill.sourceInfo?.source) ??
    "unknown"
  );
}

export function resolveSkillTelemetrySourceValue(value: unknown): SkillTelemetrySource {
  const source = normalizeOptionalString(value) ?? "";
  if (source === "bundled" || source === "paleoclaw-bundled" || source === "paleoclaw-custodian") {
    return "bundled";
  }
  if (
    source === "workspace" ||
    source === "paleoclaw-workspace" ||
    source === "paleoclaw-workshop" ||
    source === "paleoclaw-managed" ||
    source === "paleoclaw-extra" ||
    source === "agents-skills-personal" ||
    source === "agents-skills-project"
  ) {
    return "workspace";
  }
  return "unknown";
}

export function resolveSkillTelemetrySource(
  skill: Partial<Pick<Skill, "source" | "sourceInfo">>,
): SkillTelemetrySource {
  return resolveSkillTelemetrySourceValue(resolveSkillSource(skill));
}
