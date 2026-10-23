/**
 * Outbound via the WeCom self-built app API (QYAPI):
 *   GET  /cgi-bin/gettoken?corpid=&corpsecret=   → access_token (cached)
 *   POST /cgi-bin/message/send?access_token=     → text / markdown messages
 *
 * Ported from hermes-agent `wecom_callback.py` (proactive send path).
 */

import { createHash } from "node:crypto";
import type { ResolvedWecomAccount } from "./types.js";

export const QYAPI_BASE_URL = "https://qyapi.weixin.qq.com";
const ACCESS_TOKEN_TTL_SECONDS = 7200;
/**
 * WeCom rejects `message/send` payloads whose content exceeds 2048 *bytes*
 * (https://developer.work.weixin.qq.com/document/path/90236) — not characters.
 */
export const WECOM_MAX_TEXT_BYTES = 2048;
/** Refresh the cached token 60s before it expires (matches the Python port). */
const TOKEN_EARLY_REFRESH_MS = 60_000;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type WecomTextPayload = {
  touser: string;
  msgtype: "text";
  agentid: number;
  text: { content: string };
  safe: 0;
  [key: string]: unknown;
};

export type WecomMarkdownPayload = {
  touser: string;
  msgtype: "markdown";
  agentid: number;
  markdown: { content: string };
  [key: string]: unknown;
};

/**
 * Truncate content to a UTF-8 byte budget.
 *
 * Iterating by code point keeps surrogate pairs intact, so the cut never
 * leaves a lone surrogate behind.
 */
export function truncateContent(content: string, maxBytes = WECOM_MAX_TEXT_BYTES): string {
  const limit = Math.max(0, Math.floor(maxBytes));
  if (limit === 0) {
    return "";
  }
  if (Buffer.byteLength(content, "utf8") <= limit) {
    return content;
  }
  let bytes = 0;
  let end = 0;
  for (const ch of content) {
    const size = Buffer.byteLength(ch, "utf8");
    if (bytes + size > limit) {
      break;
    }
    bytes += size;
    end += ch.length;
  }
  return content.slice(0, end);
}

/**
 * Split content into chunks that each fit the WeCom byte budget, so a long
 * reply is delivered in several messages instead of being hard-cut.
 */
export function splitContentByBytes(content: string, maxBytes = WECOM_MAX_TEXT_BYTES): string[] {
  const limit = Math.max(1, Math.floor(maxBytes));
  if (!content) {
    return [];
  }
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of content) {
    const size = Buffer.byteLength(ch, "utf8");
    if (current && currentBytes + size > limit) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += ch;
    currentBytes += size;
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

export function buildTextMessagePayload(params: {
  touser: string;
  agentId: string | number;
  content: string;
}): WecomTextPayload {
  return {
    touser: params.touser,
    msgtype: "text",
    agentid: Number(params.agentId),
    text: { content: truncateContent(params.content) },
    safe: 0,
  };
}

export function buildMarkdownMessagePayload(params: {
  touser: string;
  agentId: string | number;
  content: string;
}): WecomMarkdownPayload {
  return {
    touser: params.touser,
    msgtype: "markdown",
    agentid: Number(params.agentId),
    markdown: { content: truncateContent(params.content) },
  };
}

type CachedToken = { token: string; expiresAt: number };

/**
 * Cache key that pins the credentials as well as the account id: rotating
 * `corpId`/`secret` must not keep serving the token minted for the previous
 * credentials until it expires. The secret is hashed so it never lands in a
 * map key that could be logged.
 */
function tokenCacheKey(account: { accountId: string; corpId: string; secret: string }): string {
  const secretHash = createHash("sha256").update(account.secret).digest("hex").slice(0, 16);
  return `${account.accountId}|${account.corpId}|${secretHash}`;
}

/** Access-token cache keyed per account with early refresh. */
export class AccessTokenManager {
  private readonly cache = new Map<string, CachedToken>();
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;

  constructor(options: { fetchImpl?: FetchLike; baseUrl?: string } = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? QYAPI_BASE_URL;
  }

  async getToken(account: { accountId: string; corpId: string; secret: string }): Promise<string> {
    const now = Date.now();
    const cached = this.cache.get(tokenCacheKey(account));
    if (cached && cached.expiresAt > now + TOKEN_EARLY_REFRESH_MS) {
      return cached.token;
    }
    return this.refresh(account);
  }

  async refresh(account: { accountId: string; corpId: string; secret: string }): Promise<string> {
    const url = `${this.baseUrl}/cgi-bin/gettoken?corpid=${encodeURIComponent(account.corpId)}&corpsecret=${encodeURIComponent(account.secret)}`;
    const response = await this.fetchImpl(url);
    const rawBody = await response.text();
    let data: {
      errcode?: number;
      access_token?: string;
      expires_in?: number;
    } = {};
    try {
      data = JSON.parse(rawBody) as typeof data;
    } catch {
      data = {};
    }
    if (!response.ok) {
      throw new Error(`WeCom token refresh failed: HTTP ${response.status}`);
    }
    if (data.errcode !== 0 || !data.access_token) {
      throw new Error(`WeCom token refresh failed: errcode=${data.errcode}`);
    }
    const expiresIn = data.expires_in ?? ACCESS_TOKEN_TTL_SECONDS;
    this.cache.set(tokenCacheKey(account), {
      token: data.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
    });
    return data.access_token;
  }

  invalidate(accountId: string): void {
    // The key now carries the credential fingerprint, so drop every entry
    // belonging to the account rather than a single exact key.
    const prefix = `${accountId}|`;
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Shared access-token cache.
 *
 * WeCom keeps a single live token per app, so every outbound send of every
 * account must reuse the same cache instead of minting a new token per call
 * (which would also invalidate the token an in-flight request is using).
 */
let sharedTokenManager: AccessTokenManager | null = null;

export function getWecomTokenManager(): AccessTokenManager {
  sharedTokenManager ??= new AccessTokenManager();
  return sharedTokenManager;
}

/** Test seam: install (or clear) the shared access-token cache. */
export function setWecomTokenManager(manager: AccessTokenManager | null): void {
  sharedTokenManager = manager;
}

export type WecomSendResult =
  | { ok: true; messageId: string; raw: Record<string, unknown> }
  | { ok: false; error: string; raw?: Record<string, unknown> };

/** POST one message/send payload; returns a normalized result. */
export async function sendWecomPayload(params: {
  account: Pick<ResolvedWecomAccount, "accountId" | "corpId" | "secret">;
  payload: WecomTextPayload | WecomMarkdownPayload;
  tokenManager?: AccessTokenManager;
  fetchImpl?: FetchLike;
  baseUrl?: string;
}): Promise<WecomSendResult> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const baseUrl = params.baseUrl ?? QYAPI_BASE_URL;
  // A custom transport/base URL implies an isolated cache (tests, self-hosted
  // gateways); the production path shares one cache so a burst of replies
  // reuses a single access token.
  const tokenManager =
    params.tokenManager ??
    (params.fetchImpl || params.baseUrl
      ? new AccessTokenManager({ fetchImpl, baseUrl })
      : getWecomTokenManager());
  try {
    const token = await tokenManager.getToken(params.account);
    const response = await fetchImpl(
      `${baseUrl}/cgi-bin/message/send?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params.payload),
      },
    );
    const rawBody = await response.text();
    let data: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(rawBody) as unknown;
      if (parsed && typeof parsed === "object") {
        data = parsed as Record<string, unknown>;
      }
    } catch {
      data = {};
    }
    if (!response.ok) {
      return {
        ok: false,
        error: `WeCom send failed: HTTP ${response.status} ${rawBody.slice(0, 200)}`.trim(),
        raw: data,
      };
    }
    const errcode = data.errcode;
    if (typeof errcode !== "number") {
      // A response without a numeric errcode is not a confirmed delivery.
      return {
        ok: false,
        error: `WeCom send failed: missing numeric errcode in ${rawBody.slice(0, 200)}`,
        raw: data,
      };
    }
    if (errcode !== 0) {
      return {
        ok: false,
        error: `WeCom send failed: ${JSON.stringify(data)}`,
        raw: data,
      };
    }
    return { ok: true, messageId: String(data.msgid ?? ""), raw: data };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

/** Send text (or markdown) to a WeCom user through the app API. */
export async function sendWecomMessage(params: {
  account: ResolvedWecomAccount;
  toUser: string;
  content: string;
  msgType?: "text" | "markdown";
  tokenManager?: AccessTokenManager;
  fetchImpl?: FetchLike;
  baseUrl?: string;
}): Promise<WecomSendResult> {
  const msgType = params.msgType ?? params.account.outboundMsgType ?? "text";
  const payload =
    msgType === "markdown"
      ? buildMarkdownMessagePayload({
          touser: params.toUser,
          agentId: params.account.agentId,
          content: params.content,
        })
      : buildTextMessagePayload({
          touser: params.toUser,
          agentId: params.account.agentId,
          content: params.content,
        });
  return sendWecomPayload({
    account: params.account,
    payload,
    tokenManager: params.tokenManager,
    fetchImpl: params.fetchImpl,
    baseUrl: params.baseUrl,
  });
}
