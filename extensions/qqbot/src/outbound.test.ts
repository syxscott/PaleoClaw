import { describe, expect, it } from "vitest";
import {
  MsgSeqAllocator,
  buildGuildMessageBody,
  buildV2MessageBody,
  guessQqbotChatKind,
  qqbotFilesPath,
  qqbotMessagesPath,
} from "./outbound.js";
import type { QqbotChatKind } from "./types.js";

describe("MsgSeqAllocator", () => {
  it("increments per key starting at 1", () => {
    const allocator = new MsgSeqAllocator();
    expect(allocator.next("msg-1")).toBe(1);
    expect(allocator.next("msg-1")).toBe(2);
    expect(allocator.next("msg-1")).toBe(3);
  });

  it("keeps independent counters per key", () => {
    const allocator = new MsgSeqAllocator();
    expect(allocator.next("msg-1")).toBe(1);
    expect(allocator.next("msg-2")).toBe(1);
    expect(allocator.next("msg-1")).toBe(2);
    expect(allocator.next("msg-2")).toBe(2);
  });

  it("wraps within the 1..65535 range", () => {
    const allocator = new MsgSeqAllocator();
    expect(allocator.next("key")).toBe(1);
    // Produce values 2..65534.
    for (let i = 0; i < 65533; i += 1) {
      allocator.next("key");
    }
    expect(allocator.next("key")).toBe(65535);
    expect(allocator.next("key")).toBe(1);
  });

  it("peek does not consume, reset clears", () => {
    const allocator = new MsgSeqAllocator();
    allocator.next("key");
    expect(allocator.peek("key")).toBe(2);
    expect(allocator.peek("key")).toBe(2);
    allocator.reset("key");
    expect(allocator.next("key")).toBe(1);
  });
});

describe("buildGuildMessageBody", () => {
  it("builds content + msg_seq + passive msg_id", () => {
    expect(buildGuildMessageBody({ content: "hello", msgSeq: 4, msgId: "inbound-1" })).toEqual({
      content: "hello",
      msg_seq: 4,
      msg_id: "inbound-1",
    });
  });

  it("adds a markdown block when markdown is on", () => {
    const body = buildGuildMessageBody({ content: "**bold**", msgSeq: 1, markdown: true });
    expect(body.markdown).toEqual({ content: "**bold**" });
    expect(body.content).toBe("**bold**");
  });

  it("keyboard takes precedence over markdown and is passed through verbatim", () => {
    const keyboard = { content: { rows: [{ buttons: [{ id: "b1" }] }] } };
    const body = buildGuildMessageBody({
      content: "approve?",
      msgSeq: 2,
      markdown: true,
      keyboard,
    });
    expect(body.keyboard).toEqual(keyboard);
    expect(body.markdown).toBeUndefined();
  });

  it("truncates content to the 4000 char limit", () => {
    const body = buildGuildMessageBody({ content: "x".repeat(5000), msgSeq: 1 });
    expect(String(body.content)).toHaveLength(4000);
  });
});

describe("buildV2MessageBody", () => {
  it("uses msg_type 0 for plain text", () => {
    const body = buildV2MessageBody({ content: "text", msgSeq: 1, msgId: "m-1" });
    expect(body).toMatchObject({
      msg_type: 0,
      content: "text",
      msg_seq: 1,
      msg_id: "m-1",
    });
  });

  it("uses msg_type 2 with a markdown block for markdown", () => {
    const body = buildV2MessageBody({ content: "md", msgSeq: 1, markdown: true });
    expect(body.msg_type).toBe(2);
    expect(body.markdown).toEqual({ content: "md" });
    expect(body.content).toBeUndefined();
  });

  it("builds media bodies (msg_type 7) with file_info and caption", () => {
    const body = buildV2MessageBody({
      content: "caption",
      msgSeq: 7,
      msgType: 7,
      media: { file_info: "FILE_INFO" },
    });
    expect(body.msg_type).toBe(7);
    expect(body.media).toEqual({ file_info: "FILE_INFO" });
    expect(body.content).toBe("caption");
  });
});

describe("paths", () => {
  it.each([
    ["guild", "CH-1", "/channels/CH-1/messages"],
    ["dm", "OPEN-1", "/v2/users/OPEN-1/messages"],
    ["c2c", "OPEN-1", "/v2/users/OPEN-1/messages"],
    ["group", "OPEN-1", "/v2/groups/OPEN-1/messages"],
  ] as Array<[QqbotChatKind, string, string]>)(
    "messages path for %s",
    (chatKind, targetId, expected) => {
      expect(qqbotMessagesPath(chatKind, targetId)).toBe(expected);
    },
  );

  it.each([
    ["c2c", "/v2/users/OPEN/files"],
    ["group", "/v2/groups/OPEN/files"],
  ] as Array<[QqbotChatKind, string]>)("files path for %s", (chatKind, expected) => {
    expect(qqbotFilesPath(chatKind, "OPEN")).toBe(expected);
  });
});

describe("guessQqbotChatKind", () => {
  it("prefers the learned chat-kind map", () => {
    const known = new Map<string, QqbotChatKind>([["abc", "group"]]);
    expect(guessQqbotChatKind("abc", known)).toBe("group");
  });

  it("falls back to c2c for unknown targets", () => {
    expect(guessQqbotChatKind("unknown-id")).toBe("c2c");
    expect(guessQqbotChatKind("unknown-id", new Map())).toBe("c2c");
  });
});
