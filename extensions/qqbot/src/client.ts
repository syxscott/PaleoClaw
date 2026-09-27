/**
 * QQ official bot REST client (reference adapter.py `_api_request`, `_post_message`,
 * send paths). Auth via QqbotTokenManager (`Authorization: QQBot <token>`).
 */

import { QQBOT_API_BASE, QQBOT_API_TIMEOUT_MS, QQBOT_SANDBOX_API_BASE } from "./constants.js";
import type { QqbotFetchLike } from "./token.js";
import { qqbotAuthHeaders, QqbotTokenManager } from "./token.js";
import type { QqbotChatKind } from "./types.js";

export type QqbotApiRequestResult = Record<string, unknown>;

export class QqbotApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly bizCode?: number;
  constructor(message: string, status: number, path: string, bizCode?: number) {
    super(message);
    this.name = "QqbotApiError";
    this.status = status;
    this.path = path;
    this.bizCode = bizCode;
  }
}

export class QqbotClient {
  readonly apiBase: string;
  private readonly tokenManager: QqbotTokenManager;
  private readonly fetchImpl: QqbotFetchLike;

  constructor(params: {
    tokenManager: QqbotTokenManager;
    apiBase?: string;
    sandbox?: boolean;
    fetchImpl?: QqbotFetchLike;
  }) {
    this.tokenManager = params.tokenManager;
    this.apiBase = params.apiBase ?? (params.sandbox ? QQBOT_SANDBOX_API_BASE : QQBOT_API_BASE);
    this.fetchImpl = params.fetchImpl ?? fetch;
  }

  /** Run one authenticated JSON REST request; non-2xx → QqbotApiError. */
  async request(
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: Record<string, unknown>,
    timeoutMs: number = QQBOT_API_TIMEOUT_MS,
  ): Promise<QqbotApiRequestResult> {
    const headers = await qqbotAuthHeaders(this.tokenManager);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await this.fetchImpl(`${this.apiBase}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const raw = await response.text();
    let data: unknown = null;
    if (raw.trim()) {
      try {
        data = JSON.parse(raw) as unknown;
      } catch {
        data = null;
      }
    }
    if (!response.ok) {
      const record = (data ?? {}) as Record<string, unknown>;
      const message =
        typeof record.message === "string"
          ? record.message
          : raw.slice(0, 200) || `HTTP ${response.status}`;
      const bizCode = typeof record.biz_code === "number" ? record.biz_code : undefined;
      throw new QqbotApiError(
        `QQ Bot API error [${response.status}] ${path}: ${message}`,
        response.status,
        path,
        bizCode,
      );
    }
    return (data ?? {}) as QqbotApiRequestResult;
  }

  /** Gateway wss endpoint discovery (GET /gateway → {url}). */
  async getGatewayUrl(): Promise<string> {
    const data = await this.request("GET", "/gateway");
    const url = typeof data.url === "string" ? data.url.trim() : "";
    if (!url) {
      throw new QqbotApiError("QQ Bot gateway response missing url", 200, "/gateway");
    }
    return url;
  }

  /** POST a message body to a chat target; returns the raw response (has `id`). */
  async postMessage(
    chatKind: QqbotChatKind,
    targetId: string,
    body: Record<string, unknown>,
    path?: string,
  ): Promise<QqbotApiRequestResult> {
    const resolvedPath = path ?? messagesPathFor(chatKind, targetId);
    return await this.request("POST", resolvedPath, body);
  }
}

function messagesPathFor(chatKind: QqbotChatKind, targetId: string): string {
  if (chatKind === "guild") {
    return `/channels/${targetId}/messages`;
  }
  const kind = chatKind === "c2c" || chatKind === "dm" ? "users" : "groups";
  return `/v2/${kind}/${targetId}/messages`;
}
