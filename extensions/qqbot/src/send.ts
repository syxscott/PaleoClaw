/**
 * High-level QQ outbound send helpers used by the channel outbound adapter and
 * the inbound reply dispatcher. Keeps per-account API clients, the msg_seq
 * allocator, and inbound chat-kind memory (reference `_chat_type_map`).
 */

import { resolveQqbotAccount } from "./accounts.js";
import { QqbotClient } from "./client.js";
import { QQ_MSG_TYPE_MEDIA, QQBOT_MAX_MESSAGE_LENGTH } from "./constants.js";
import { uploadQqbotLocalFile, uploadQqbotMediaUrl } from "./media.js";
import {
  MsgSeqAllocator,
  buildGuildMessageBody,
  buildV2MessageBody,
  guessQqbotChatKind,
  qqbotMessagesPath,
} from "./outbound.js";
import { QqbotTokenManager } from "./token.js";
import type { CoreConfig, QqbotChatKind, ResolvedQqbotAccount } from "./types.js";

export class QqbotAccountContext {
  readonly account: ResolvedQqbotAccount;
  readonly tokenManager: QqbotTokenManager;
  readonly client: QqbotClient;
  readonly allocator = new MsgSeqAllocator();
  /** chatId → chat kind learned from inbound events (outbound path resolution). */
  readonly chatKinds = new Map<string, QqbotChatKind>();

  constructor(account: ResolvedQqbotAccount) {
    this.account = account;
    this.tokenManager = new QqbotTokenManager({
      appId: account.appId,
      clientSecret: account.clientSecret,
    });
    this.client = new QqbotClient({
      tokenManager: this.tokenManager,
      sandbox: account.sandbox,
    });
  }

  rememberChatKind(chatId: string, kind: QqbotChatKind): void {
    this.chatKinds.set(chatId, kind);
  }

  resolveChatKind(chatId: string): QqbotChatKind {
    return guessQqbotChatKind(chatId, this.chatKinds);
  }

  /**
   * Send text (as markdown or plain per account config) to a chat target.
   * `replyTo` is the inbound QQ message id (passive msg_id).
   */
  async sendText(params: {
    chatId: string;
    text: string;
    replyTo?: string;
    markdown?: boolean;
    keyboard?: Record<string, unknown>;
  }): Promise<{ channelId: string; messageId: string }> {
    const chatKind = this.resolveChatKind(params.chatId);
    const markdown = params.markdown ?? this.account.markdown;
    const seqKey = params.replyTo || params.chatId;
    const body =
      chatKind === "guild"
        ? buildGuildMessageBody({
            content: params.text,
            msgSeq: this.allocator.next(seqKey),
            msgId: params.replyTo,
            markdown,
            keyboard: params.keyboard,
          })
        : buildV2MessageBody({
            content: params.text,
            msgSeq: this.allocator.next(seqKey),
            msgId: params.replyTo,
            markdown,
            keyboard: params.keyboard,
          });
    const data = await this.client.postMessage(
      chatKind,
      params.chatId,
      body,
      qqbotMessagesPath(chatKind, params.chatId),
    );
    return {
      channelId: params.chatId,
      messageId: typeof data.id === "string" ? data.id : "",
    };
  }

  /**
   * Send media: HTTP(S) URLs go through the single-request URL upload; anything
   * else is treated as a local path and goes through the chunked upload.
   */
  async sendMedia(params: {
    chatId: string;
    mediaUrl: string;
    caption?: string;
    mediaKind?: "image" | "video" | "voice" | "file";
    replyTo?: string;
  }): Promise<{ channelId: string; messageId: string }> {
    const chatKind = this.resolveChatKind(params.chatId);
    if (chatKind === "guild") {
      throw new Error("Guild media send is not supported by the QQ v2 upload API");
    }
    const isHttp = /^https?:\/\//i.test(params.mediaUrl);
    const mediaKind = params.mediaKind ?? guessMediaKind(params.mediaUrl);
    const upload = isHttp
      ? await uploadQqbotMediaUrl({
          client: this.client,
          chatKind,
          targetId: params.chatId,
          mediaKind,
          url: params.mediaUrl,
        })
      : await uploadQqbotLocalFile({
          client: this.client,
          chatKind,
          targetId: params.chatId,
          mediaKind,
          filePath: params.mediaUrl,
        });

    const body = buildV2MessageBody({
      content: (params.caption ?? "").slice(0, QQBOT_MAX_MESSAGE_LENGTH),
      msgType: QQ_MSG_TYPE_MEDIA,
      media: { file_info: upload.fileInfo },
      msgSeq: this.allocator.next(params.replyTo || params.chatId),
      msgId: params.replyTo,
    });
    const data = await this.client.postMessage(
      chatKind,
      params.chatId,
      body,
      qqbotMessagesPath(chatKind, params.chatId),
    );
    return {
      channelId: params.chatId,
      messageId: typeof data.id === "string" ? data.id : "",
    };
  }
}

const contexts = new Map<string, QqbotAccountContext>();

export function getQqbotAccountContext(account: ResolvedQqbotAccount): QqbotAccountContext {
  const existing = contexts.get(account.accountId);
  if (existing) {
    return existing;
  }
  const context = new QqbotAccountContext(account);
  contexts.set(account.accountId, context);
  return context;
}

/** Clear cached contexts (tests / account removal). */
export function clearQqbotAccountContexts(): void {
  contexts.clear();
}

/** Convenience wrapper: send text via the default/selected account. */
export async function sendMessageQqbot(params: {
  cfg: CoreConfig;
  to: string;
  text: string;
  accountId?: string | null;
  replyTo?: string;
}): Promise<{ messageId: string; chatId: string }> {
  const account = resolveQqbotAccount({ cfg: params.cfg, accountId: params.accountId });
  if (!account.configured) {
    throw new Error("QQBot is not configured (appId + appSecret/clientSecret)");
  }
  const context = getQqbotAccountContext(account);
  const result = await context.sendText({
    chatId: params.to,
    text: params.text,
    replyTo: params.replyTo,
  });
  return { messageId: result.messageId, chatId: params.to };
}

function guessMediaKind(source: string): "image" | "video" | "voice" | "file" {
  const ext = source.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "heic"].includes(ext)) {
    return "image";
  }
  if (["mp4", "mov", "mkv", "webm", "avi"].includes(ext)) {
    return "video";
  }
  if (["silk", "amr", "mp3", "wav", "ogg", "m4a", "aac", "flac", "speex"].includes(ext)) {
    return "voice";
  }
  return "file";
}
