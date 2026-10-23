import { resolveAgentDir } from "paleoclaw/plugin-sdk/agent-scope-runtime";
import type { OpenClawConfig } from "paleoclaw/plugin-sdk/provider-auth";
import { resolveApiKeyForProvider } from "paleoclaw/plugin-sdk/provider-auth-runtime";
import { normalizeOptionalString } from "paleoclaw/plugin-sdk/string-coerce-runtime";

export async function resolveXaiRealtimeApiKey(
  configApiKey: string | undefined,
  cfg: OpenClawConfig | undefined,
  agentId?: string,
): Promise<string> {
  const direct =
    normalizeOptionalString(configApiKey) ?? normalizeOptionalString(process.env.XAI_API_KEY);
  if (direct) {
    return direct;
  }
  const auth = await resolveApiKeyForProvider({
    provider: "xai",
    cfg,
    ...(cfg && agentId ? { agentDir: resolveAgentDir(cfg, agentId) } : {}),
  });
  const oauthKey = normalizeOptionalString(auth?.apiKey);
  if (oauthKey) {
    return oauthKey;
  }
  throw new Error(
    "xAI credentials missing for realtime voice. Sign in with `paleoclaw onboard --auth-choice xai-oauth`, run `paleoclaw onboard --auth-choice xai-api-key`, or set XAI_API_KEY.",
  );
}
