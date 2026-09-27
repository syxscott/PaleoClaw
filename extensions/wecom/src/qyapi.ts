/**
 * Outbound via the WeCom self-built app API (QYAPI):
 *   GET  /cgi-bin/gettoken?corpid=&corpsecret=   → access_token (cached)
 *   POST /cgi-bin/message/send?access_token=     → text / markdown messages
 *
 * Ported from hermes-agent `wecom_callback.py` (proactive send path).
 */

import type { ResolvedWecomAccount } from "./types.js";

export const QYAPI_BASE_URL = "https://qyapi.weixin.qq.com";
const ACCESS_TOKEN_TTL_SECONDS = 7200;
const MAX_TEXT_LENGTH = 2048;
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

export function truncateContent(content: string, maxLength = MAX_TEXT_LENGTH): string {
  return content.slice(0, maxLength);
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
    const cached = this.cache.get(account.accountId);
    if (cached && cached.expiresAt > now + TOKEN_EARLY_REFRESH_MS) {
      return cached.token;
    }
    return this.refresh(account);
  }

  async refresh(account: { accountId: string; corpId: string; secret: string }): Promise<string> {
    const url = `${this.baseUrl}/cgi-bin/gettoken?corpid=${encodeURIComponent(account.corpId)}&corpsecret=${encodeURIComponent(account.secret)}`;
    const response = await this.fetchImpl(url);
    const data = (await response.json()) as {
      errcode?: number;
      access_token?: string;
      expires_in?: number;
    };
    if (data.errcode !== 0 || !data.access_token) {
      throw new Error(`WeCom token refresh failed: errcode=${data.errcode}`);
    }
    const expiresIn = data.expires_in ?? ACCESS_TOKEN_TTL_SECONDS;
    this.cache.set(account.accountId, {
      token: data.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
    });
    return data.access_token;
  }

  invalidate(accountId: string): void {
    this.cache.delete(accountId);
  }
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
  const tokenManager = params.tokenManager ?? new AccessTokenManager({ fetchImpl, baseUrl });
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
    const data = (await response.json()) as Record<string, unknown>;
    const errcode = typeof data.errcode === "number" ? data.errcode : 0;
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
  });
}
