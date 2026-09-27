import { describe, expect, it } from "vitest";
import { ITEM_FILE, ITEM_IMAGE, ITEM_TEXT, ITEM_VOICE } from "./ilink.js";
import { extractTextFromItems, guessChatType, normalizeWeixinMessage } from "./normalize.js";
import type { WeixinIlinkMessage } from "./types.js";

const BOT_ID = "botid@im.bot";

describe("extractTextFromItems (port of _extract_text)", () => {
  it("extracts plain text", () => {
    expect(extractTextFromItems([{ type: ITEM_TEXT, text_item: { text: "你好" } }])).toEqual({
      text: "你好",
      isVoiceTranscription: false,
    });
  });

  it("prefixes media quotes from ref_msg", () => {
    const result = extractTextFromItems([
      {
        type: ITEM_TEXT,
        text_item: { text: "看这个" },
        ref_msg: {
          title: "photo.jpg",
          message_item: { type: ITEM_IMAGE, image_item: {} },
        },
      },
    ]);
    expect(result.text).toBe("[引用媒体: photo.jpg]\n看这个");
  });

  it("prefixes text quotes with title and nested text", () => {
    const result = extractTextFromItems([
      {
        type: ITEM_TEXT,
        text_item: { text: "回复" },
        ref_msg: {
          title: "原始消息",
          message_item: { type: ITEM_TEXT, text_item: { text: "被引用" } },
        },
      },
    ]);
    expect(result.text).toBe("[引用: 原始消息 | 被引用]\n回复");
  });

  it("marks Weixin-provided voice transcription when no raw media exists", () => {
    const result = extractTextFromItems([
      { type: ITEM_VOICE, voice_item: { text: "语音识别结果" } },
    ]);
    expect(result.text).toBe("[Voice transcription provided by Weixin]\n语音识别结果");
    expect(result.isVoiceTranscription).toBe(true);
  });

  it("returns empty for voice with raw media (caller should re-transcribe)", () => {
    const result = extractTextFromItems([
      {
        type: ITEM_VOICE,
        voice_item: { text: "garbled", media: { encrypt_query_param: "x" } },
      },
    ]);
    expect(result.text).toBe("");
  });

  it("returns empty for non-text items", () => {
    expect(
      extractTextFromItems([{ type: ITEM_FILE, file_item: { file_name: "a.bin" } }]).text,
    ).toBe("");
  });
});

describe("guessChatType (port of _guess_chat_type)", () => {
  it("treats messages with room_id as group messages", () => {
    const message: WeixinIlinkMessage = {
      from_user_id: "alice",
      room_id: "room123",
      msg_type: 1,
    };
    expect(guessChatType(message, BOT_ID)).toEqual({ chatType: "group", chatId: "room123" });
  });

  it("treats to_user_id != bot with msg_type 1 as group", () => {
    const message: WeixinIlinkMessage = {
      from_user_id: "alice",
      to_user_id: "room456",
      msg_type: 1,
    };
    expect(guessChatType(message, BOT_ID)).toEqual({ chatType: "group", chatId: "room456" });
  });

  it("treats direct messages as dm keyed by the sender", () => {
    const message: WeixinIlinkMessage = { from_user_id: "alice", msg_type: 1 };
    expect(guessChatType(message, BOT_ID)).toEqual({ chatType: "dm", chatId: "alice" });
  });
});

describe("normalizeWeixinMessage", () => {
  it("normalizes a full DM text message", () => {
    const message: WeixinIlinkMessage = {
      message_id: "m1",
      from_user_id: "alice",
      msg_type: 1,
      context_token: "ctx-1",
      item_list: [{ type: ITEM_TEXT, text_item: { text: "hello bot" } }],
    };
    const normalized = normalizeWeixinMessage(message, BOT_ID);
    expect(normalized).not.toBeNull();
    expect(normalized?.chatType).toBe("dm");
    expect(normalized?.chatId).toBe("alice");
    expect(normalized?.senderId).toBe("alice");
    expect(normalized?.text).toBe("hello bot");
    expect(normalized?.messageId).toBe("m1");
  });

  it("returns null for self-messages or empty payloads", () => {
    expect(
      normalizeWeixinMessage(
        { from_user_id: BOT_ID, item_list: [{ type: ITEM_TEXT, text_item: { text: "self" } }] },
        BOT_ID,
      ),
    ).toBeNull();
    expect(normalizeWeixinMessage({ from_user_id: "alice" }, BOT_ID)).toBeNull();
    expect(normalizeWeixinMessage({ from_user_id: "" }, BOT_ID)).toBeNull();
  });

  it("collects media items", () => {
    const message: WeixinIlinkMessage = {
      from_user_id: "alice",
      item_list: [
        { type: ITEM_IMAGE, image_item: { mid_size: 1 } },
        { type: ITEM_FILE, file_item: { file_name: "doc.pdf" } },
      ],
    };
    const normalized = normalizeWeixinMessage(message, BOT_ID);
    expect(normalized?.mediaItems.map((m) => m.kind)).toEqual(["image", "file"]);
    expect(normalized?.text).toBe("");
  });
});
