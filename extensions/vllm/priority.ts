import type { StreamFn } from "paleoclaw/plugin-sdk/agent-core";
import type { ProviderWrapStreamFnContext } from "paleoclaw/plugin-sdk/plugin-entry";
import { normalizeProviderId } from "paleoclaw/plugin-sdk/provider-model-metadata";
import { wrapProviderPayloadHook } from "paleoclaw/plugin-sdk/provider-stream-shared";
import { asOptionalObjectRecord } from "paleoclaw/plugin-sdk/string-coerce-runtime";

export function wrapVllmPriorityStream(ctx: ProviderWrapStreamFnContext): StreamFn | undefined {
  const underlying = ctx.streamFn;
  if (
    !underlying ||
    normalizeProviderId(ctx.provider) !== "vllm" ||
    ctx.modelParams?.priorityScheduling !== true
  ) {
    return underlying;
  }
  const priority =
    ctx.modelCallUrgency === "foreground" ? -100 : ctx.modelCallUrgency === "background" ? 100 : 0;
  const wrapped: StreamFn = (model, context, options) => {
    if (
      normalizeProviderId(model.provider) !== "vllm" ||
      model.id !== ctx.modelId ||
      (ctx.sourceApi ?? model.api) !== "openai-completions"
    ) {
      return underlying(model, context, options);
    }
    return underlying(model, context, {
      ...options,
      onPayload: wrapProviderPayloadHook(options?.onPayload, (payload, replacement) => {
        // Explicit dynamic scheduling owns priority after ordinary payload overrides.
        // Mutate only this request; fallback models keep their own configured fields.
        const result = replacement ?? payload;
        const body = asOptionalObjectRecord(result);
        if (body) {
          body.priority = priority;
        }
        return result;
      }),
    });
  };
  return Object.assign(wrapped, { preservesGenericCompatibility: true });
}
