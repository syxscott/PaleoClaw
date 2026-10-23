import { listModelRefsFromConfigValue } from "@paleoclaw/model-catalog-core/configured-model-refs";
import {
  asNullableObjectRecord,
  asNullableRecord,
} from "@paleoclaw/normalization-core/record-coerce";
import { normalizeSortedUniqueTrimmedStringList } from "@paleoclaw/normalization-core/string-normalization";

export function resolveConfiguredCronModelSuggestions(
  configForm: Record<string, unknown> | null | undefined,
): string[] {
  const agents = asNullableObjectRecord(configForm?.agents);
  if (!agents) {
    return [];
  }
  const defaults = asNullableObjectRecord(agents.defaults);
  return normalizeSortedUniqueTrimmedStringList([
    ...listModelRefsFromConfigValue(defaults?.model),
    ...Object.keys(asNullableObjectRecord(defaults?.models) ?? {}),
    ...Object.values(asNullableRecord(agents.entries) ?? {}).flatMap((entry) =>
      listModelRefsFromConfigValue(asNullableObjectRecord(entry)?.model),
    ),
  ]);
}
