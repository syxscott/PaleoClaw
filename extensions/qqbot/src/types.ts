import type { OpenClawConfig } from "paleoclaw/plugin-sdk/qqbot";

/** DM / group intake policy (mirrors the reference dm_policy / group_policy). */
export type QqbotAccessPolicy = "open" | "allowlist" | "pairing" | "disabled";

/** Transport mode. Only the official WebSocket gateway is implemented. */
export type QqbotMode = "websocket";

export type QqbotAccountConfig = {
  name?: string;
  enabled?: boolean;
  /** QQ 开放平台 AppID (or QQ_APP_ID env). */
  appId?: string;
  /** AppSecret used together with appId to obtain the access token (or QQ_APP_SECRET env). */
  appSecret?: string;
  /** Alias for appSecret, matching QQ console terminology (or QQ_CLIENT_SECRET env). */
  clientSecret?: string;
  mode?: QqbotMode;
  /** Use https://sandbox.api.sgroup.qq.com instead of production. */
  sandbox?: boolean;
  /** Send outbound text as markdown payload blocks (msg_type 2). Default true. */
  markdown?: boolean;
  intents?: number;
  dmPolicy?: QqbotAccessPolicy;
  allowFrom?: Array<string | number>;
  groupPolicy?: QqbotAccessPolicy;
  groupAllowFrom?: Array<string | number>;
  defaultTo?: string;
};

export type QqbotConfig = QqbotAccountConfig & {
  accounts?: Record<string, QqbotAccountConfig>;
  defaultAccount?: string;
};

export type CoreConfig = OpenClawConfig & {
  channels?: OpenClawConfig["channels"] & {
    qqbot?: QqbotConfig;
  };
};

/** Where a normalized inbound message came from. */
export type QqbotChatKind = "guild" | "dm" | "c2c" | "group";

export type QqbotAttachment = {
  contentType: string;
  url: string;
  filename?: string;
};

/** Normalized inbound message (payload normalization output). */
export type QqbotInboundMessage = {
  /** Original QQ dispatch event type, e.g. "AT_MESSAGE_CREATE". */
  eventType: string;
  chatKind: QqbotChatKind;
  /** QQ message id — used for dedupe and passive replies (msg_id). */
  messageId: string;
  /** Where replies go: channel_id (guild), guild_id (dm), user_openid (c2c), group_openid (group). */
  chatId: string;
  senderId: string;
  senderName?: string;
  /** Mention-stripped text content. */
  content: string;
  rawContent: string;
  isMention: boolean;
  attachments: QqbotAttachment[];
  timestamp: number;
  /** Gateway sequence number. */
  seq?: number;
  raw: unknown;
};

export type ResolvedQqbotAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  appId: string;
  /** clientSecret after appSecret/clientSecret resolution. */
  clientSecret: string;
  secretSource:
    | "config:appSecret"
    | "config:clientSecret"
    | "env:QQ_APP_SECRET"
    | "env:QQ_CLIENT_SECRET"
    | "none";
  mode: QqbotMode;
  sandbox: boolean;
  markdown: boolean;
  intents: number;
  dmPolicy: QqbotAccessPolicy;
  allowFrom: string[];
  groupPolicy: QqbotAccessPolicy;
  groupAllowFrom: string[];
  defaultTo?: string;
};
