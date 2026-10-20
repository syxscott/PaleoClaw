/**
 * Tencent iLink Bot HTTP API client — TypeScript port of the pure-HTTP core of
 * hermes-agent `gateway/platforms/weixin.py`.
 *
 * This is the actual mechanism that reference uses for 微信 personal-account
 * bridging (NOT wechaty / NOT a pad protocol / NOT the official OA API):
 *   - long-poll POST ilink/bot/getupdates       (inbound, cursor-based)
 *   - POST     ilink/bot/sendmessage            (outbound, context_token echo)
 *   - POST     ilink/bot/getconfig              (typing tickets)
 *   - GET      ilink/bot/get_bot_qrcode         (QR login)
 *   - GET      ilink/bot/get_qrcode_status      (QR login poll)
 * All calls are plain HTTPS/JSON via the SSRF-guarded fetch — no native deps.
 */

import { randomBytes } from "node:crypto";
import { fetchWithSsrFGuard } from "paleoclaw/plugin-sdk/weixin";
import type { LookupFn, SsrFPolicy } from "paleoclaw/plugin-sdk/weixin";
import type { WeixinIlinkMessage } from "./types.js";

export const ILINK_BASE_URL = "https://ilinkai.weixin.qq.com";
export const WEIXIN_CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c";
export const ILINK_APP_ID = "bot";
export const CHANNEL_VERSION = "2.2.0";
/** (2 << 16) | (2 << 8) | 0 — ported verbatim from the Python reference. */
export const ILINK_APP_CLIENT_VERSION = (2 << 16) | (2 << 8) | 0;

export const EP_GET_UPDATES = "ilink/bot/getupdates";
export const EP_SEND_MESSAGE = "ilink/bot/sendmessage";
export const EP_SEND_TYPING = "ilink/bot/sendtyping";
export const EP_GET_CONFIG = "ilink/bot/getconfig";
export const EP_GET_UPLOAD_URL = "ilink/bot/getuploadurl";
export const EP_GET_BOT_QR = "ilink/bot/get_bot_qrcode";
export const EP_GET_QR_STATUS = "ilink/bot/get_qrcode_status";

export const LONG_POLL_TIMEOUT_MS = 35_000;
export const API_TIMEOUT_MS = 15_000;
export const QR_TIMEOUT_MS = 35_000;

/** ret/errcode -14 (and -2 "unknown error") = stale session. */
export const SESSION_EXPIRED_ERRCODE = -14;
export const RATE_LIMIT_ERRCODE = -2;

export const MSG_TYPE_BOT = 2;
export const MSG_STATE_FINISH = 2;
/** iLink item_list entry types (ported constants). */
export const ITEM_TEXT = 1;
export const ITEM_IMAGE = 2;
export const ITEM_VOICE = 3;
export const ITEM_FILE = 4;
export const ITEM_VIDEO = 5;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Options shared by every guarded iLink HTTP call. */
export type IlinkHttpOptions = {
  /** Injected fetch (tests / custom transports). */
  fetchImpl?: FetchLike;
  /** Injected DNS resolver (tests / custom pinning). */
  lookupFn?: LookupFn;
  /** SSRF policy override (private-network allowances). */
  ssrfPolicy?: SsrFPolicy;
  /** Aborts an in-flight request (used by the monitor on stop). */
  signal?: AbortSignal;
};

/** Raised when an iLink request exceeds its timeout budget. */
export class IlinkTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IlinkTimeoutError";
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

/**
 * Adapt the plugin-level `FetchLike` (string URL) to the guard's fetch
 * signature. The guard always calls with a stringified absolute URL.
 */
function toGuardedFetch(fetchImpl?: FetchLike) {
  if (!fetchImpl) {
    return undefined;
  }
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
    fetchImpl(typeof input === "string" ? input : String(input), init);
}

/**
 * Perform one guarded iLink HTTP request. All outbound calls go through the
 * SSRF guard (the bot token travels in the Authorization header, so the
 * operator-supplied `baseUrl` must never be fetched unguarded).
 */
async function ilinkRequest(params: {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  fetchImpl?: FetchLike;
  lookupFn?: LookupFn;
  ssrfPolicy?: SsrFPolicy;
  signal?: AbortSignal;
}): Promise<{ ok: boolean; status: number; text: string }> {
  const { response, release } = await fetchWithSsrFGuard({
    url: params.url,
    init: {
      method: params.method,
      headers: params.headers,
      ...(params.body === undefined ? {} : { body: params.body }),
    },
    timeoutMs: params.timeoutMs,
    fetchImpl: toGuardedFetch(params.fetchImpl),
    lookupFn: params.lookupFn,
    policy: params.ssrfPolicy,
    signal: params.signal,
    auditContext: "weixin-ilink",
  });
  try {
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } finally {
    await release();
  }
}

/** Random 4-byte uin, base64-encoded (port of the `_headers` X-WECHAT-UIN). */
export const randomUinBytes = (): Buffer => randomBytes(4);

/**
 * Build iLink request headers (port of `_headers`).
 * `uinSource` is injectable for deterministic tests.
 */
export function buildIlinkHeaders(
  token: string | undefined,
  body: string,
  uinSource: () => Buffer = () => randomUinBytes(),
): Record<string, string> {
  const uin = Buffer.from(uinSource().readUInt32BE(0).toString(), "utf8").toString("base64");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "Content-Length": String(Buffer.byteLength(body, "utf8")),
    "X-WECHAT-UIN": uin,
    "iLink-App-Id": ILINK_APP_ID,
    "iLink-App-ClientVersion": String(ILINK_APP_CLIENT_VERSION),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** Port of `_is_stale_session_ret`: ret/errcode -2 with "unknown error" is stale-session. */
export function isSessionExpired(
  resp: Record<string, unknown>,
  ret: unknown,
  errcode: unknown,
): boolean {
  const errmsg = String(resp.errmsg ?? "").toLowerCase();
  const staleRet =
    (ret === RATE_LIMIT_ERRCODE || errcode === RATE_LIMIT_ERRCODE) && errmsg === "unknown error";
  return ret === SESSION_EXPIRED_ERRCODE || errcode === SESSION_EXPIRED_ERRCODE || staleRet;
}

export type IlinkResponse = Record<string, unknown>;

/** POST a JSON payload with iLink headers and timeout; returns parsed JSON. */
export async function ilinkPost(
  params: {
    baseUrl: string;
    endpoint: string;
    payload: Record<string, unknown>;
    token?: string;
    timeoutMs: number;
  } & IlinkHttpOptions,
): Promise<IlinkResponse> {
  const body = JSON.stringify({
    ...params.payload,
    base_info: { channel_version: CHANNEL_VERSION },
  });
  return await ilinkJsonRequest({
    url: `${params.baseUrl.replace(/\/+$/, "")}/${params.endpoint}`,
    method: "POST",
    headers: buildIlinkHeaders(params.token, body),
    body,
    timeoutMs: params.timeoutMs,
    endpoint: params.endpoint,
    fetchImpl: params.fetchImpl,
    lookupFn: params.lookupFn,
    ssrfPolicy: params.ssrfPolicy,
    signal: params.signal,
  });
}

/** GET an iLink endpoint with timeout. */
export async function ilinkGet(
  params: {
    baseUrl: string;
    endpoint: string;
    timeoutMs: number;
  } & IlinkHttpOptions,
): Promise<IlinkResponse> {
  return await ilinkJsonRequest({
    url: `${params.baseUrl.replace(/\/+$/, "")}/${params.endpoint}`,
    method: "GET",
    headers: {
      "iLink-App-Id": ILINK_APP_ID,
      "iLink-App-ClientVersion": String(ILINK_APP_CLIENT_VERSION),
    },
    timeoutMs: params.timeoutMs,
    endpoint: params.endpoint,
    fetchImpl: params.fetchImpl,
    lookupFn: params.lookupFn,
    ssrfPolicy: params.ssrfPolicy,
    signal: params.signal,
  });
}

async function ilinkJsonRequest(params: {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  endpoint: string;
  fetchImpl?: FetchLike;
  lookupFn?: LookupFn;
  ssrfPolicy?: SsrFPolicy;
  signal?: AbortSignal;
}): Promise<IlinkResponse> {
  try {
    const result = await ilinkRequest(params);
    if (!result.ok) {
      throw new Error(
        `iLink ${params.method} ${params.endpoint} HTTP ${result.status}: ${result.text.slice(0, 200)}`,
      );
    }
    return JSON.parse(result.text) as IlinkResponse;
  } catch (error) {
    if (isAbortError(error) && !params.signal?.aborted) {
      throw new IlinkTimeoutError(
        `iLink ${params.method} ${params.endpoint} timed out after ${params.timeoutMs}ms`,
      );
    }
    throw error;
  }
}

/** Long-poll getupdates. Timeout → empty batch (same semantics as the port). */
export async function getUpdates(
  params: {
    baseUrl: string;
    token: string;
    syncBuf: string;
    timeoutMs?: number;
  } & IlinkHttpOptions,
): Promise<{
  ret?: number;
  errcode?: number;
  msgs?: WeixinIlinkMessage[];
  get_updates_buf?: string;
  longpolling_timeout_ms?: number;
}> {
  try {
    const response = await ilinkPost({
      baseUrl: params.baseUrl,
      endpoint: EP_GET_UPDATES,
      payload: { get_updates_buf: params.syncBuf },
      token: params.token,
      timeoutMs: params.timeoutMs ?? LONG_POLL_TIMEOUT_MS,
      fetchImpl: params.fetchImpl,
      lookupFn: params.lookupFn,
      ssrfPolicy: params.ssrfPolicy,
      signal: params.signal,
    });
    return {
      ret: response.ret as number | undefined,
      errcode: response.errcode as number | undefined,
      msgs: (response.msgs as WeixinIlinkMessage[] | undefined) ?? [],
      get_updates_buf: response.get_updates_buf as string | undefined,
      longpolling_timeout_ms: response.longpolling_timeout_ms as number | undefined,
    };
  } catch (error) {
    // A long poll that times out is an empty batch (ported behavior). Every other
    // transport/HTTP failure MUST surface so the monitor can log it and back off
    // instead of treating the channel as a healthy empty poll.
    if (error instanceof IlinkTimeoutError) {
      return { ret: 0, errcode: 0, msgs: [], get_updates_buf: params.syncBuf };
    }
    throw error;
  }
}

/** Build the `msg` body for sendmessage (port of `_send_items` / `_send_message`). */
export function buildSendMessagePayload(params: {
  to: string;
  text: string;
  contextToken?: string | null;
  clientId: string;
}): Record<string, unknown> {
  if (!params.text || !params.text.trim()) {
    throw new Error("weixin sendmessage: text must not be empty");
  }
  const message: Record<string, unknown> = {
    from_user_id: "",
    to_user_id: params.to,
    client_id: params.clientId,
    message_type: MSG_TYPE_BOT,
    message_state: MSG_STATE_FINISH,
    item_list: [{ type: ITEM_TEXT, text_item: { text: params.text } }],
  };
  if (params.contextToken) {
    message.context_token = params.contextToken;
  }
  return { msg: message };
}

/** Send a text message. */
export function sendMessage(
  params: {
    baseUrl: string;
    token: string;
    to: string;
    text: string;
    contextToken?: string | null;
    clientId: string;
    timeoutMs?: number;
  } & IlinkHttpOptions,
): Promise<IlinkResponse> {
  return ilinkPost({
    baseUrl: params.baseUrl,
    endpoint: EP_SEND_MESSAGE,
    payload: buildSendMessagePayload({
      to: params.to,
      text: params.text,
      contextToken: params.contextToken,
      clientId: params.clientId,
    }),
    token: params.token,
    timeoutMs: params.timeoutMs ?? API_TIMEOUT_MS,
    fetchImpl: params.fetchImpl,
    lookupFn: params.lookupFn,
    ssrfPolicy: params.ssrfPolicy,
    signal: params.signal,
  });
}

export type QrLoginCredentials = {
  accountId: string;
  token: string;
  baseUrl: string;
  userId: string;
};

/**
 * QR login handshake (port of `qr_login`): fetch a QR, poll its status until
 * confirmed, and return the credentials. Rendering the QR is the caller's job
 * (no terminal/QR dependency here — return the URL for display).
 */
export async function qrLogin(
  params: {
    botType?: string;
    timeoutSeconds?: number;
    pollIntervalMs?: number;
    onQr?: (qrUrl: string) => void;
    onStatus?: (status: string) => void;
    baseUrl?: string;
  } & IlinkHttpOptions,
): Promise<QrLoginCredentials | null> {
  const baseUrl = params.baseUrl ?? ILINK_BASE_URL;
  const botType = params.botType ?? "3";
  const deadline = Date.now() + (params.timeoutSeconds ?? 480) * 1000;

  const qrResp = await ilinkGet({
    baseUrl,
    endpoint: `${EP_GET_BOT_QR}?bot_type=${botType}`,
    timeoutMs: QR_TIMEOUT_MS,
    fetchImpl: params.fetchImpl,
    lookupFn: params.lookupFn,
    ssrfPolicy: params.ssrfPolicy,
    signal: params.signal,
  });
  const qrcodeValue = String(qrResp.qrcode ?? "");
  const qrcodeUrl = String(qrResp.qrcode_img_content ?? "");
  if (!qrcodeValue) {
    return null;
  }
  params.onQr?.(qrcodeUrl || qrcodeValue);

  while (Date.now() < deadline) {
    let statusResp: IlinkResponse;
    try {
      statusResp = await ilinkGet({
        baseUrl,
        endpoint: `${EP_GET_QR_STATUS}?qrcode=${encodeURIComponent(qrcodeValue)}`,
        timeoutMs: QR_TIMEOUT_MS,
        fetchImpl: params.fetchImpl,
        lookupFn: params.lookupFn,
        ssrfPolicy: params.ssrfPolicy,
        signal: params.signal,
      });
    } catch {
      await sleep(1000);
      continue;
    }
    const status = String(statusResp.status ?? "wait");
    params.onStatus?.(status);
    if (status === "wait") {
      await sleep(params.pollIntervalMs ?? 1000);
      continue;
    }
    if (status === "expired") {
      return null;
    }
    if (status === "confirmed") {
      const accountId = String(statusResp.ilink_bot_id ?? "");
      const token = String(statusResp.bot_token ?? "");
      if (!accountId || !token) {
        return null;
      }
      return {
        accountId,
        token,
        baseUrl: String(statusResp.baseurl ?? baseUrl),
        userId: String(statusResp.ilink_user_id ?? ""),
      };
    }
    await sleep(params.pollIntervalMs ?? 1000);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
