import type { TelegramAccountConfig } from "paleoclaw/plugin-sdk/config-contracts";
import { resolvePromptHistoryLimit } from "paleoclaw/plugin-sdk/number-runtime";

const DEFAULT_TELEGRAM_DM_HISTORY_LIMIT = 10;

export function resolveTelegramDmHistoryLimit(params: {
  config: TelegramAccountConfig;
  senderId?: string | number;
}): number {
  const senderId = params.senderId === undefined ? undefined : String(params.senderId);
  const override = senderId ? params.config.dms?.[senderId]?.historyLimit : undefined;
  return resolvePromptHistoryLimit(
    override ?? params.config.dmHistoryLimit,
    DEFAULT_TELEGRAM_DM_HISTORY_LIMIT,
  );
}
