/**
 * QQ 官方机器人（QQ open platform official bot）protocol constants.
 *
 * Ported from the Hermes-Agent reference implementation
 * (gateway/platforms/qqbot/constants.py): WebSocket gateway for inbound events,
 * REST (api.sgroup.qq.com) for outbound messages and media uploads.
 */

/** Production REST API base (guild + v2 c2c/group endpoints). */
export const QQBOT_API_BASE = "https://api.sgroup.qq.com";
/** Sandbox REST API base (channels.qqbot.sandbox=true). */
export const QQBOT_SANDBOX_API_BASE = "https://sandbox.api.sgroup.qq.com";
/** App access token endpoint (POST, JSON body {appId, clientSecret}). */
export const QQBOT_TOKEN_URL = "https://bots.qq.com/app/getAppAccessToken";
/** Gateway wss endpoint discovery path (GET {apiBase}/gateway). */
export const QQBOT_GATEWAY_PATH = "/gateway";

export const QQBOT_MAX_MESSAGE_LENGTH = 4000;

export const QQBOT_DEFAULT_TOKEN_TTL_SECONDS = 7200;
/** Refresh the token this many ms before it actually expires. */
export const QQBOT_TOKEN_EXPIRY_MARGIN_MS = 60_000;
/** Default HTTP timeout for REST calls (ms). */
export const QQBOT_API_TIMEOUT_MS = 30_000;
/** Timeout for file uploads (ms). */
export const QQBOT_FILE_UPLOAD_TIMEOUT_MS = 120_000;

// ── WebSocket op codes ──
export const QQ_OP_DISPATCH = 0;
export const QQ_OP_HEARTBEAT = 1;
export const QQ_OP_IDENTIFY = 2;
export const QQ_OP_RESUME = 6;
export const QQ_OP_RECONNECT = 7;
export const QQ_OP_INVALID_SESSION = 9;
export const QQ_OP_HELLO = 10;
export const QQ_OP_HEARTBEAT_ACK = 11;

// ── Intents (bit field sent with op 2 Identify) ──
export const QQ_INTENT_GUILD_MESSAGES = 1 << 0; // MESSAGE_CREATE etc. (private domain)
export const QQ_INTENT_DIRECT_MESSAGE = 1 << 12; // DIRECT_MESSAGE_CREATE
export const QQ_INTENT_C2C_GROUP_AT_MESSAGES = 1 << 25; // C2C_MESSAGE_CREATE / GROUP_AT_MESSAGE_CREATE
export const QQ_INTENT_INTERACTION = 1 << 26;
export const QQ_INTENT_PUBLIC_GUILD_MESSAGES = 1 << 30; // AT_MESSAGE_CREATE
export const QQBOT_DEFAULT_INTENTS =
  QQ_INTENT_GUILD_MESSAGES |
  QQ_INTENT_DIRECT_MESSAGE |
  QQ_INTENT_C2C_GROUP_AT_MESSAGES |
  QQ_INTENT_PUBLIC_GUILD_MESSAGES;

// ── Message (msg_type) / media (file_type) kinds ──
export const QQ_MSG_TYPE_TEXT = 0;
export const QQ_MSG_TYPE_MARKDOWN = 2;
export const QQ_MSG_TYPE_INPUT_NOTIFY = 6;
export const QQ_MSG_TYPE_MEDIA = 7;
export const QQ_MEDIA_TYPE_IMAGE = 1;
export const QQ_MEDIA_TYPE_VIDEO = 2;
export const QQ_MEDIA_TYPE_VOICE = 3;
export const QQ_MEDIA_TYPE_FILE = 4;

/** Heartbeat at 80% of the server-provided Hello interval (reference behavior). */
export const QQ_HEARTBEAT_SCALE = 0.8;
/** Heartbeat interval used until Hello arrives (ms). */
export const QQ_HEARTBEAT_FALLBACK_MS = 30_000;

// ── WebSocket close codes ──
export const QQ_CLOSE_INVALID_TOKEN = 4004;
export const QQ_CLOSE_RATE_LIMITED = 4008;

/**
 * Unrecoverable close codes → stop reconnecting (reference _FATAL_CLOSE_CODES).
 */
export const QQ_FATAL_CLOSE_CODES: Readonly<Record<number, string>> = {
  4001: "invalid opcode",
  4002: "invalid payload",
  4010: "invalid shard",
  4011: "sharding required",
  4012: "invalid API version",
  4013: "invalid intent",
  4014: "intent not authorized",
  4914: "offline/sandbox-only",
  4915: "banned",
};

/**
 * Close codes that invalidate the session → clear it and re-identify on the
 * next Hello. 4009 (connection timeout) is deliberately absent: it is resumable
 * per the QQ protocol and must keep session state (reference behavior).
 */
export function isSessionInvalidCloseCode(code: number): boolean {
  return code === 4006 || code === 4007 || (code >= 4900 && code < 4914);
}

/** Escalating reconnect ladder (ms) — mirrors the reference RECONNECT_BACKOFF. */
export const QQ_RECONNECT_BACKOFF_MS: readonly number[] = [2_000, 5_000, 10_000, 30_000, 60_000];
/** Give up after this many consecutive failed reconnect attempts. */
export const QQ_MAX_RECONNECT_ATTEMPTS = 100;
/** Extra delay when close code 4008 (rate limited) is received (ms). */
export const QQ_RATE_LIMIT_DELAY_MS = 60_000;

/** Chunked-upload biz codes (reference chunked_upload.py). */
export const QQ_UPLOAD_BIZ_CODE_DAILY_LIMIT = 40093002;
export const QQ_UPLOAD_BIZ_CODE_PART_RETRYABLE = 40093001;
/** First N bytes hashed for the md5_10m field (per QQ upload spec). */
export const QQ_UPLOAD_MD5_10M_SIZE = 10_002_432;
