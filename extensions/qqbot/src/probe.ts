/**
 * Probe the QQ REST API for one account: obtains an access token and lists
 * nothing else — a successful token fetch proves appId/secret are valid.
 */

import { maskQqbotAppId, resolveQqbotAccount } from "./accounts.js";
import { getQqbotAccountContext } from "./send.js";
import type { CoreConfig } from "./types.js";

export type QqbotProbe = {
  ok: boolean;
  error?: string;
  sandbox: boolean;
  /** Masked AppID (the full id is never exposed). */
  appId: string;
  configured: boolean;
};

export async function probeQqbot(
  cfg: CoreConfig,
  options?: { accountId?: string | null },
): Promise<QqbotProbe> {
  const account = resolveQqbotAccount({ cfg, accountId: options?.accountId });
  if (!account.configured) {
    return {
      ok: false,
      error: "not configured (missing appId or appSecret/clientSecret)",
      sandbox: account.sandbox,
      appId: maskQqbotAppId(account.appId),
      configured: false,
    };
  }
  try {
    const context = getQqbotAccountContext(account);
    await context.tokenManager.getToken();
    return {
      ok: true,
      sandbox: account.sandbox,
      appId: maskQqbotAppId(account.appId),
      configured: true,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      sandbox: account.sandbox,
      appId: maskQqbotAppId(account.appId),
      configured: true,
    };
  }
}
