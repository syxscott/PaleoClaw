/**
 * QQ open platform app access token management (reference adapter.py
 * `_ensure_token` / `_token_fresh`).
 *
 * Endpoint: POST https://bots.qq.com/app/getAppAccessToken with a JSON body
 * `{appId, clientSecret}` — this matches both the Python reference and the
 * official QQ bot docs (response `{access_token, expires_in}`, expires_in is a
 * number or numeric string, default 7200s). The token is sent as
 * `Authorization: QQBot <token>` on REST calls and inside Identify/Resume payloads.
 */

export type QqbotFetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

export type QqbotTokenSnapshot = {
  hasToken: boolean;
  expiresAtMs: number;
  lastError: string | null;
  refreshCount: number;
};

const DEFAULT_TOKEN_URL = "https://bots.qq.com/app/getAppAccessToken";
const DEFAULT_TTL_FALLBACK_SECONDS = 7200;
/** Refresh this many ms before expiry (reference uses a 60s margin). */
const EXPIRY_MARGIN_MS = 60_000;
const REQUEST_TIMEOUT_MS = 30_000;

export class QqbotTokenError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "QqbotTokenError";
    this.status = status;
  }
}

export class QqbotTokenManager {
  private readonly appId: string;
  private readonly clientSecret: string;
  private readonly tokenUrl: string;
  private readonly fetchImpl: QqbotFetchLike;
  private readonly nowMs: () => number;
  private readonly ttlFallbackSeconds: number;

  private token: string | null = null;
  private expiresAtMs = 0;
  private lastError: string | null = null;
  private refreshCount = 0;
  private pending: Promise<string> | null = null;

  constructor(params: {
    appId: string;
    clientSecret: string;
    tokenUrl?: string;
    fetchImpl?: QqbotFetchLike;
    nowMs?: () => number;
    ttlFallbackSeconds?: number;
  }) {
    this.appId = params.appId;
    this.clientSecret = params.clientSecret;
    this.tokenUrl = params.tokenUrl ?? DEFAULT_TOKEN_URL;
    this.fetchImpl = params.fetchImpl ?? fetch;
    this.nowMs = params.nowMs ?? Date.now;
    this.ttlFallbackSeconds = params.ttlFallbackSeconds ?? DEFAULT_TTL_FALLBACK_SECONDS;
  }

  get snapshot(): QqbotTokenSnapshot {
    return {
      hasToken: this.token !== null,
      expiresAtMs: this.expiresAtMs,
      lastError: this.lastError,
      refreshCount: this.refreshCount,
    };
  }

  /** True when a cached token is still valid past the refresh margin. */
  isFresh(): boolean {
    return Boolean(this.token) && this.nowMs() < this.expiresAtMs - EXPIRY_MARGIN_MS;
  }

  /** Return a valid access token, refreshing if needed (singleflight). */
  async getToken(): Promise<string> {
    if (this.isFresh() && this.token) {
      return this.token;
    }
    if (this.pending) {
      return this.pending;
    }
    this.pending = this.refresh().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  /** Drop the cached token (e.g. after WS close code 4004 invalid token). */
  invalidate(): void {
    this.token = null;
    this.expiresAtMs = 0;
  }

  async refresh(): Promise<string> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response;
      try {
        response = await this.fetchImpl(this.tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ appId: this.appId, clientSecret: this.clientSecret }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const raw = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(raw) as unknown;
      } catch {
        throw new QqbotTokenError(
          `QQ Bot access token response is not JSON [${response.status}]: ${raw.slice(0, 200)}`,
          response.status,
        );
      }
      if (!response.ok) {
        throw new QqbotTokenError(
          `QQ Bot access token request failed [${response.status}]: ${raw.slice(0, 200)}`,
          response.status,
        );
      }

      const record = (data ?? {}) as Record<string, unknown>;
      const token = typeof record.access_token === "string" ? record.access_token.trim() : "";
      if (!token) {
        throw new QqbotTokenError(
          `QQ Bot token response missing access_token: ${raw.slice(0, 200)}`,
          response.status,
        );
      }
      const expiresIn = parseExpiresIn(record.expires_in) ?? this.ttlFallbackSeconds;
      this.token = token;
      this.expiresAtMs = this.nowMs() + expiresIn * 1000;
      this.lastError = null;
      this.refreshCount += 1;
      return token;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }
}

function parseExpiresIn(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

/** Auth headers for JSON REST calls with a fresh bot token. */
export async function qqbotAuthHeaders(
  tokenManager: QqbotTokenManager,
): Promise<Record<string, string>> {
  const token = await tokenManager.getToken();
  return {
    Authorization: `QQBot ${token}`,
    "Content-Type": "application/json",
  };
}
