/**
 * Outbound messaging for the QQ official bot REST API (reference adapter.py
 * "Outbound messaging — REST API").
 *
 * Paths:
 * - guild:  POST {apiBase}/channels/{channel_id}/messages        {content, msg_id?, msg_seq, markdown?, keyboard?}
 * - c2c:    POST {apiBase}/v2/users/{user_openid}/messages       {content|markdown, msg_type, msg_id?, msg_seq, ...}
 * - group:  POST {apiBase}/v2/groups/{group_openid}/messages     (same body shape as c2c)
 *
 * msg_seq: for the same inbound msg_id (passive reply) QQ requires a distinct,
 * increasing msg_seq per additional reply — MsgSeqAllocator hands out 1..N per key.
 */

import {
  QQ_MSG_TYPE_MARKDOWN,
  QQ_MSG_TYPE_MEDIA,
  QQ_MSG_TYPE_TEXT,
  QQBOT_MAX_MESSAGE_LENGTH,
} from "./constants.js";
import type { QqbotChatKind } from "./types.js";

/** Monotonic msg_seq allocator: per-key 1..65535 (wraps). */
export class MsgSeqAllocator {
  private counters = new Map<string, number>();

  next(key: string): number {
    const current = this.counters.get(key) ?? 0;
    const nextValue = (current % 65535) + 1;
    this.counters.set(key, nextValue);
    return nextValue;
  }

  peek(key: string): number {
    return (this.counters.get(key) ?? 0) + 1;
  }

  reset(key: string): void {
    this.counters.delete(key);
  }
}

export type QqbotOutboundBody = {
  content: string;
  /** Inbound message id this reply is passive to (required for passive replies). */
  msgId?: string;
  msgSeq: number;
  markdown?: boolean;
  /** QQ keyboard/markdown DSL pass-through (built by the caller; see README). */
  keyboard?: Record<string, unknown>;
};

/** Guild channel message body (POST /channels/{id}/messages). */
export function buildGuildMessageBody(body: QqbotOutboundBody): Record<string, unknown> {
  const out: Record<string, unknown> = {
    content: body.content.slice(0, QQBOT_MAX_MESSAGE_LENGTH),
    msg_seq: body.msgSeq,
  };
  if (body.msgId) {
    out.msg_id = body.msgId;
  }
  if (body.keyboard) {
    out.keyboard = body.keyboard;
  } else if (body.markdown) {
    out.markdown = { content: body.content.slice(0, QQBOT_MAX_MESSAGE_LENGTH) };
  }
  return out;
}

/** v2 c2c/group message body (POST /v2/{users|groups}/{id}/messages). */
export function buildV2MessageBody(
  body: QqbotOutboundBody & {
    /** Overrides the text/markdown auto-selection (e.g. media = 7). */
    msgType?: number;
    media?: Record<string, unknown>;
  },
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    msg_type: body.msgType ?? (body.markdown ? QQ_MSG_TYPE_MARKDOWN : QQ_MSG_TYPE_TEXT),
    msg_seq: body.msgSeq,
  };
  if (body.msgType === QQ_MSG_TYPE_MEDIA && body.media) {
    out.media = body.media;
    if (body.content) {
      out.content = body.content.slice(0, QQBOT_MAX_MESSAGE_LENGTH);
    }
  } else if (body.markdown && !body.keyboard) {
    out.markdown = { content: body.content.slice(0, QQBOT_MAX_MESSAGE_LENGTH) };
  } else {
    out.content = body.content.slice(0, QQBOT_MAX_MESSAGE_LENGTH);
  }
  if (body.msgId) {
    out.msg_id = body.msgId;
  }
  if (body.keyboard) {
    out.keyboard = body.keyboard;
  }
  return out;
}

/**
 * Guild DMs (QQ `DIRECT_MESSAGE_CREATE`) have no v2 reply endpoint: the only
 * ids the payload carries are the guild id and the author id, and neither maps
 * to a valid `/v2/users/{id}/messages` target. Refuse explicitly instead of
 * posting a request that can never succeed.
 */
export function assertQqbotChatKindSupported(chatKind: QqbotChatKind): void {
  if (chatKind === "dm") {
    throw new Error(
      "QQ guild direct messages cannot be replied to (the QQ v2 API has no guild DM endpoint)",
    );
  }
}

/** REST path for a chat kind + target id (reference _rest_path). */
export function qqbotMessagesPath(chatKind: QqbotChatKind, targetId: string): string {
  if (chatKind === "guild") {
    return `/channels/${targetId}/messages`;
  }
  // "dm" (guild DM) is rejected by assertQqbotChatKindSupported before any
  // request is built; the mapping below is kept for the path helper contract.
  const kind = chatKind === "c2c" || chatKind === "dm" ? "users" : "groups";
  return `/v2/${kind}/${targetId}/messages`;
}

/** Files (media upload) path for a chat kind + target id. */
export function qqbotFilesPath(chatKind: QqbotChatKind, targetId: string): string {
  const kind = chatKind === "c2c" || chatKind === "dm" ? "users" : "groups";
  return `/v2/${kind}/${targetId}/files`;
}

/** Best-effort chat-kind guess for outbound targets (reference _guess_chat_type). */
export function guessQqbotChatKind(
  chatId: string,
  known?: ReadonlyMap<string, QqbotChatKind>,
): QqbotChatKind {
  const fromMap = known?.get(chatId);
  if (fromMap) {
    return fromMap;
  }
  // Guild/channel ids and v2 group openids are opaque; default to c2c (users path).
  return "c2c";
}
