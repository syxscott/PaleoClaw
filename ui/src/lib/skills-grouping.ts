import type { SkillStatusEntry } from "../api/types.ts";
import { t } from "../i18n/index.ts";

export type SkillGroup = {
  id: string;
  label: string;
  skills: SkillStatusEntry[];
};

const SKILL_SOURCE_GROUPS: Array<{ id: string; labelKey: string; sources: string[] }> = [
  { id: "workspace", labelKey: "skillGroups.workspace", sources: ["paleoclaw-workspace"] },
  { id: "learned", labelKey: "skillGroups.learned", sources: ["paleoclaw-workshop"] },
  { id: "built-in", labelKey: "skillGroups.builtIn", sources: ["paleoclaw-bundled"] },
  { id: "installed", labelKey: "skillGroups.installed", sources: ["paleoclaw-managed"] },
  { id: "extra", labelKey: "skillGroups.extra", sources: ["paleoclaw-extra"] },
];

export function groupSkills(skills: SkillStatusEntry[]): SkillGroup[] {
  const groups: Array<{ sources: string[]; group: SkillGroup }> = SKILL_SOURCE_GROUPS.map(
    ({ id, labelKey, sources }) => ({
      sources,
      group: { id, label: t(labelKey), skills: [] },
    }),
  );
  const builtInGroup = groups.find(({ group }) => group.id === "built-in");
  const other: SkillGroup = { id: "other", label: t("skillGroups.other"), skills: [] };
  for (const skill of skills) {
    const match = skill.bundled
      ? builtInGroup
      : groups.find(({ sources }) => sources.includes(skill.source));
    (match?.group ?? other).skills.push(skill);
  }
  return [...groups.map(({ group }) => group), other].filter((group) => group.skills.length > 0);
}
