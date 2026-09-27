/**
 * Inbound normalization for iLink getupdates messages — port of the pure
 * helpers in hermes-agent `weixin.py` (`_extract_text`, `_guess_chat_type`).
 */

import { ITEM_FILE, ITEM_IMAGE, ITEM_TEXT, ITEM_VIDEO, ITEM_VOICE } from "./ilink.js";
import type { WeixinIlinkItem, WeixinIlinkMessage, WeixinInboundMessage } from "./types.js";

export type ExtractedText = {
  text: string;
  isVoiceTranscription: boolean;
};

/**
 * Extract text from an item_list, honoring `ref_msg` quote context
 * (port of `_extract_text`).
 * Note: Weixin's own `voice_item.text` STT is unreliable for non-Chinese
 * audio — it is surfaced but flagged so callers can re-transcribe.
 */
export function extractTextFromItems(itemList: WeixinIlinkItem[] | undefined): ExtractedText {
  const items = itemList ?? [];
  for (const item of items) {
    if (item.type !== ITEM_TEXT) {
      continue;
    }
    const text = String(item.text_item?.text ?? "");
    const ref = item.ref_msg ?? {};
    const refItem = ref.message_item;
    if (refItem && [ITEM_IMAGE, ITEM_VIDEO, ITEM_FILE, ITEM_VOICE].includes(refItem.type ?? 0)) {
      const title = ref.title ?? "";
      return {
        text: (title ? `[引用媒体: ${title}]\n${text}` : `[引用媒体]\n${text}`).trim(),
        isVoiceTranscription: false,
      };
    }
    if (refItem) {
      const parts = [ref.title ?? "", extractTextFromItems([refItem]).text].filter(Boolean);
      if (parts.length > 0) {
        return {
          text: `[引用: ${parts.join(" | ")}]\n${text}`.trim(),
          isVoiceTranscription: false,
        };
      }
    }
    return { text, isVoiceTranscription: false };
  }
  // Voice with Tencent's transcript but no downloadable media: use it, marked.
  for (const item of items) {
    if (item.type === ITEM_VOICE) {
      const voiceItem = item.voice_item ?? {};
      const voiceText = String(voiceItem.text ?? "");
      if (!voiceItem.media && voiceText) {
        return {
          text: `[Voice transcription provided by Weixin]\n${voiceText}`,
          isVoiceTranscription: true,
        };
      }
    }
  }
  return { text: "", isVoiceTranscription: false };
}

/**
 * Group messages carry room_id / chat_room_id (or a to_user_id that is not us
 * on msg_type=1); everything else is a DM (port of `_guess_chat_type`).
 */
export function guessChatType(
  message: WeixinIlinkMessage,
  botId: string,
): { chatType: "dm" | "group"; chatId: string } {
  const roomId = String(message.room_id ?? message.chat_room_id ?? "").trim();
  const toUserId = String(message.to_user_id ?? "").trim();
  if (roomId || (toUserId && botId && toUserId !== botId && message.msg_type === 1)) {
    return {
      chatType: "group",
      chatId: roomId || toUserId || String(message.from_user_id ?? ""),
    };
  }
  return { chatType: "dm", chatId: String(message.from_user_id ?? "") };
}

const MEDIA_ITEM_KEYS: Record<number, "image" | "video" | "file" | "voice"> = {
  [ITEM_IMAGE]: "image",
  [ITEM_VIDEO]: "video",
  [ITEM_FILE]: "file",
  [ITEM_VOICE]: "voice",
} as const;

/** Collect downloadable media items (top level only — refs stay textual). */
export function collectMediaItems(itemList: WeixinIlinkItem[] | undefined): Array<{
  kind: "image" | "video" | "file" | "voice";
  item: WeixinIlinkItem;
}> {
  const out: Array<{ kind: "image" | "video" | "file" | "voice"; item: WeixinIlinkItem }> = [];
  for (const item of itemList ?? []) {
    const kind = MEDIA_ITEM_KEYS[item.type ?? 0];
    if (kind) {
      out.push({ kind, item });
    }
  }
  return out;
}

/** Normalize a raw iLink message into the gateway inbound shape. */
export function normalizeWeixinMessage(
  message: WeixinIlinkMessage,
  botId: string,
): WeixinInboundMessage | null {
  const senderId = String(message.from_user_id ?? "").trim();
  if (!senderId || senderId === botId) {
    return null;
  }
  const { chatType, chatId } = guessChatType(message, botId);
  const { text, isVoiceTranscription } = extractTextFromItems(message.item_list);
  const mediaItems = collectMediaItems(message.item_list);
  if (!text && mediaItems.length === 0) {
    return null;
  }
  return {
    chatType,
    chatId,
    senderId,
    text,
    messageId: String(message.message_id ?? ""),
    isVoiceTranscription,
    mediaItems,
    raw: message,
  };
}
