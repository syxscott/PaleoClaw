import { normalizeTrimmedStringList } from "@paleoclaw/normalization-core/string-normalization";
import { truncateUtf16Safe } from "@paleoclaw/normalization-core/utf16-slice";
import { defaultVoiceWakeTriggers } from "../infra/voicewake.js";

export function normalizeVoiceWakeTriggers(input: unknown): string[] {
  const cleaned = normalizeTrimmedStringList(input)
    .slice(0, 32)
    .map((value) => truncateUtf16Safe(value, 64));
  return cleaned.length > 0 ? cleaned : defaultVoiceWakeTriggers();
}
