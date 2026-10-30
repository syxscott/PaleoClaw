/**
 * Type definitions for the 微信 WeChat (iLink bot bridge) channel plugin.
 *
 * HONEST MECHANISM NOTE (from hermes-agent `gateway/platforms/weixin.py`):
 * the Python reference does NOT use wechaty, a pad protocol, or the official
 * WeChat OA API. It bridges a personal WeChat account through Tencent's
 * **iLink Bot HTTP API** (`https://ilinkai.weixin.qq.com`, app id "bot"):
 *   - login     = `ilink/bot/get_bot_qrcode` + `get_qrcode_status` QR handshake
 *   - inbound   = long-poll `ilink/bot/getupdates` (sync cursor `get_updates_buf`)
 *   - outbound  = `ilink/bot/sendmessage`, where every reply MUST echo the
 *                 peer's latest `context_token`
 *   - media     = AES-128-ECB-encrypted blobs on `novac2c.cdn.weixin.qq.com`
 * This is the same mechanism ported here (pure HTTP via fetch; no native deps).
 */

/** Raw channel config from paleoclaw.json channels.weixin */
export interface WeixinChannelConfig {
  enabled?: boolean;
  /** iLink bot identity id (e.g. "xxx@im.bot") returned by the QR login. */
  botId?: string;
  /** Bot token from the QR login (`bot_token`). */
  token?: string;
  baseUrl?: string;
  cdnBaseUrl?: string;
  dmPolicy?: "open" | "pairing" | "allowlist" | "disabled";
  allowFrom?: string | string[];
  groupPolicy?: "open" | "allowlist" | "disabled";
  groupAllowFrom?: string | string[];
  maxMessageLength?: number;
  accounts?: Record<string, WeixinAccountRaw>;
}

/** Raw per-account config (overrides base config) */
export interface WeixinAccountRaw {
  enabled?: boolean;
  botId?: string;
  token?: string;
  baseUrl?: string;
  cdnBaseUrl?: string;
  dmPolicy?: "open" | "pairing" | "allowlist" | "disabled";
  allowFrom?: string | string[];
  groupPolicy?: "open" | "allowlist" | "disabled";
  groupAllowFrom?: string | string[];
  maxMessageLength?: number;
}

/** Fully resolved account config with defaults applied */
export interface ResolvedWeixinAccount {
  accountId: string;
  /** iLink bot identity (WEIXIN_ACCOUNT_ID in the Python reference). */
  botId: string;
  enabled: boolean;
  token: string;
  baseUrl: string;
  cdnBaseUrl: string;
  dmPolicy: "open" | "pairing" | "allowlist" | "disabled";
  allowFrom: string[];
  groupPolicy: "open" | "allowlist" | "disabled";
  groupAllowFrom: string[];
  maxMessageLength: number;
  configured: boolean;
}

/** Raw iLink getupdates message (subset of fields we consume). */
export interface WeixinIlinkMessage {
  message_id?: string | number;
  from_user_id?: string;
  to_user_id?: string;
  room_id?: string;
  chat_room_id?: string;
  msg_type?: number;
  context_token?: string;
  item_list?: WeixinIlinkItem[];
  [key: string]: unknown;
}

export interface WeixinIlinkItem {
  type?: number;
  text_item?: { text?: string };
  ref_msg?: {
    title?: string;
    message_item?: WeixinIlinkItem;
  };
  image_item?: WeixinMediaPayload;
  video_item?: WeixinMediaPayload;
  file_item?: WeixinMediaPayload & { file_name?: string; len?: string };
  voice_item?: WeixinMediaPayload & {
    text?: string;
    encode_type?: number;
    sample_rate?: number;
    bits_per_sample?: number;
    playtime?: number;
  };
  [key: string]: unknown;
}

export interface WeixinMediaPayload {
  media?: {
    encrypt_query_param?: string;
    aes_key?: string;
    encrypt_type?: number;
    full_url?: string;
  };
  aeskey?: string;
  mid_size?: number;
  [key: string]: unknown;
}

/** Normalized inbound message handed to the gateway. */
export type WeixinInboundMessage = {
  chatType: "dm" | "group";
  chatId: string;
  senderId: string;
  text: string;
  messageId: string;
  /** Voice transcription marked as provided by Weixin (untrusted STT). */
  isVoiceTranscription: boolean;
  /** Media references (CDN params) — download left behind the media interface. */
  mediaItems: Array<{ kind: "image" | "video" | "file" | "voice"; item: WeixinIlinkItem }>;
  raw: WeixinIlinkMessage;
};
