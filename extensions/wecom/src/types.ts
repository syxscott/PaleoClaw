/**
 * Type definitions for the WeCom (企业微信) channel plugin.
 */

/** Raw channel config from paleoclaw.json channels.wecom */
export interface WecomChannelConfig {
  enabled?: boolean;
  corpId?: string;
  agentId?: string | number;
  secret?: string;
  token?: string;
  encodingAesKey?: string;
  callbackPath?: string;
  dmPolicy?: "open" | "allowlist" | "disabled";
  allowFrom?: string | string[];
  /** Outbound msgtype for text replies: plain "text" or rendered "markdown". */
  outboundMsgType?: "text" | "markdown";
  accounts?: Record<string, WecomAccountRaw>;
}

/** Raw per-account config (overrides base config) */
export interface WecomAccountRaw {
  enabled?: boolean;
  corpId?: string;
  agentId?: string | number;
  secret?: string;
  token?: string;
  encodingAesKey?: string;
  callbackPath?: string;
  dmPolicy?: "open" | "allowlist" | "disabled";
  allowFrom?: string | string[];
  outboundMsgType?: "text" | "markdown";
}

/** Fully resolved account config with defaults applied */
export interface ResolvedWecomAccount {
  accountId: string;
  enabled: boolean;
  corpId: string;
  agentId: string;
  secret: string;
  token: string;
  encodingAesKey: string;
  callbackPath: string;
  dmPolicy: "open" | "allowlist" | "disabled";
  allowFrom: string[];
  outboundMsgType: "text" | "markdown";
  configured: boolean;
}

/** Normalized inbound message decrypted from a WeCom callback. */
export type WecomInboundMessage = {
  kind: "message" | "event";
  msgType: string;
  fromUserId: string;
  toUserName: string;
  agentId?: string;
  msgId?: string;
  createTime?: string;
  /** Text content for text messages (or "/start" substituted for intake events). */
  content?: string;
  /** Image message fields. */
  picUrl?: string;
  /** Media id shared by image/voice messages (usable with the media get API). */
  mediaId?: string;
  /** Voice message fields. */
  voiceFormat?: string;
  recognition?: string;
  /** Event fields. */
  eventName?: string;
  eventKey?: string;
  /** Raw decrypted XML. */
  rawXml: string;
};
