/** Resolves create-time default delivery for new cron jobs. */
import { shouldDefaultCronDeliveryToAnnounce } from "../delivery-defaults.js";
import type { CronDelivery, CronJobCreate } from "../types.js";

/**
 * Resolves default cron delivery for new jobs when callers omit explicit delivery config.
 * This is the direct-service contract: supported creation paths (gateway `cron.add`,
 * agent cron tool) already fill delivery in `normalizeCronJobCreate`, so this default
 * only governs callers that reach `CronService.add`/declarative convergence directly.
 * The shared predicate keeps this contract consistent across write-time,
 * read-time, and service-bypass paths.
 */
export function resolveInitialCronDelivery(input: CronJobCreate): CronDelivery | undefined {
  if (input.delivery !== undefined) {
    return input.delivery;
  }
  if (
    shouldDefaultCronDeliveryToAnnounce({
      payloadKind: input.payload.kind,
      sessionTarget: input.sessionTarget,
    })
  ) {
    return { mode: "announce" };
  }
  return undefined;
}

// --- PaleoClaw 兼容层：normalizeCronCreateDeliveryInput（pc 3 月 API，上游 10 月已改名）---
export function normalizeCronCreateDeliveryInput(input: CronJobCreate): CronJobCreate {
  const payloadRecord =
    input.payload && typeof input.payload === "object"
      ? ({ ...input.payload } as Record<string, unknown>)
      : null;
  const deliveryRecord =
    input.delivery && typeof input.delivery === "object"
      ? ({ ...input.delivery } as Record<string, unknown>)
      : null;
  const normalizedLegacy = normalizeLegacyDeliveryInput({
    delivery: deliveryRecord,
    payload: payloadRecord,
  });
  if (!normalizedLegacy.mutated) {
    return input;
  }
  return {
    ...input,
    payload: payloadRecord ? (payloadRecord as typeof input.payload) : input.payload,
    delivery: (normalizedLegacy.delivery as CronDelivery | undefined) ?? input.delivery,
  };
}
