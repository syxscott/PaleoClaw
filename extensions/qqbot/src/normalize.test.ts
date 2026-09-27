import { describe, expect, it } from "vitest";
import {
  detectMention,
  isHandledQqbotEvent,
  normalizeQqbotEvent,
  parseQqbotTimestamp,
  stripAtMention,
} from "./normalize.js";

describe("normalizeQqbotEvent", () => {
  it("normalizes AT_MESSAGE_CREATE (guild @-message)", () => {
    const message = normalizeQqbotEvent("AT_MESSAGE_CREATE", {
      id: "msg-1",
      channel_id: "ch-123",
      guild_id: "g-1",
      content: "<@!bot-9> hello world",
      author: { id: "u-1", username: "alice" },
      member: { nick: "Alice" },
      mentions: [{ id: "bot-9" }],
      timestamp: "2026-01-01T12:00:00+08:00",
    });

    expect(message).not.toBeNull();
    expect(message?.chatKind).toBe("guild");
    expect(message?.chatId).toBe("ch-123");
    expect(message?.senderId).toBe("u-1");
    expect(message?.senderName).toBe("Alice");
    expect(message?.messageId).toBe("msg-1");
    expect(message?.isMention).toBe(true);
    expect(message?.content).toBe("hello world");
    expect(message?.rawContent).toBe("<@!bot-9> hello world");
  });

  it("normalizes MESSAGE_CREATE (guild, no mention)", () => {
    const message = normalizeQqbotEvent("MESSAGE_CREATE", {
      id: "msg-2",
      channel_id: "ch-123",
      content: "plain channel chatter",
      author: { id: "u-2", username: "bob" },
      timestamp: 1767225600000,
    });

    expect(message).not.toBeNull();
    expect(message?.chatKind).toBe("guild");
    expect(message?.isMention).toBe(false);
    expect(message?.content).toBe("plain channel chatter");
    expect(message?.timestamp).toBe(1767225600000);
  });

  it("normalizes DIRECT_MESSAGE_CREATE (dm keyed by guild id)", () => {
    const message = normalizeQqbotEvent("DIRECT_MESSAGE_CREATE", {
      id: "msg-3",
      guild_id: "g-77",
      content: "dm text",
      author: { id: "u-3" },
    });

    expect(message).not.toBeNull();
    expect(message?.chatKind).toBe("dm");
    expect(message?.chatId).toBe("g-77");
    expect(message?.senderId).toBe("u-3");
    expect(message?.isMention).toBe(false);
  });

  it("normalizes C2C_MESSAGE_CREATE (v2 direct, openid)", () => {
    const message = normalizeQqbotEvent("C2C_MESSAGE_CREATE", {
      id: "msg-4",
      content: "  hi bot  ",
      author: { user_openid: "OPEN-USER-1" },
      attachments: [{ content_type: "image/png", url: "//multimedia.qq.com/a.png" }],
    });

    expect(message).not.toBeNull();
    expect(message?.chatKind).toBe("c2c");
    expect(message?.chatId).toBe("OPEN-USER-1");
    expect(message?.senderId).toBe("OPEN-USER-1");
    expect(message?.content).toBe("hi bot");
    expect(message?.attachments).toEqual([
      { contentType: "image/png", url: "https://multimedia.qq.com/a.png", filename: undefined },
    ]);
  });

  it("normalizes GROUP_AT_MESSAGE_CREATE (v2 group, strips @mention)", () => {
    const message = normalizeQqbotEvent("GROUP_AT_MESSAGE_CREATE", {
      id: "msg-5",
      group_openid: "OPEN-GROUP-1",
      content: "<@!BOT-OPENID> 请帮我查化石",
      author: { member_openid: "OPEN-MEMBER-1" },
    });

    expect(message).not.toBeNull();
    expect(message?.chatKind).toBe("group");
    expect(message?.chatId).toBe("OPEN-GROUP-1");
    expect(message?.senderId).toBe("OPEN-MEMBER-1");
    expect(message?.isMention).toBe(true);
    expect(message?.content).toBe("请帮我查化石");
  });

  it("returns null for unknown event types", () => {
    expect(normalizeQqbotEvent("GUILD_MEMBER_UPDATE", { id: "x" })).toBeNull();
    expect(normalizeQqbotEvent("INTERACTION_CREATE", { id: "x" })).toBeNull();
  });

  it("returns null when the payload has no message id or is malformed", () => {
    expect(normalizeQqbotEvent("AT_MESSAGE_CREATE", { content: "no id" })).toBeNull();
    expect(normalizeQqbotEvent("AT_MESSAGE_CREATE", null)).toBeNull();
    expect(normalizeQqbotEvent("AT_MESSAGE_CREATE", "string-payload")).toBeNull();
  });

  it("returns null when chat/sender ids are missing", () => {
    expect(
      normalizeQqbotEvent("AT_MESSAGE_CREATE", { id: "m", content: "x", author: {} }),
    ).toBeNull();
    expect(
      normalizeQqbotEvent("C2C_MESSAGE_CREATE", { id: "m", content: "x", author: {} }),
    ).toBeNull();
  });
});

describe("stripAtMention", () => {
  it("strips <@!id> and <@id> prefixes", () => {
    expect(stripAtMention("<@!12345> hi")).toBe("hi");
    expect(stripAtMention("<@12345> hi")).toBe("hi");
  });

  it("strips stacked mentions and plain @name prefixes", () => {
    expect(stripAtMention("<@!1> <@2> twice")).toBe("twice");
    expect(stripAtMention("@bot do a thing")).toBe("do a thing");
  });

  it("leaves text without mentions untouched", () => {
    expect(stripAtMention("no mentions here")).toBe("no mentions here");
  });
});

describe("detectMention", () => {
  it("detects via the mentions array", () => {
    expect(detectMention("hello", [{ id: "bot" }])).toBe(true);
    expect(detectMention("hello", [])).toBe(false);
  });

  it("detects inline mention tags", () => {
    expect(detectMention("<@!99> hi", undefined)).toBe(true);
    expect(detectMention("no tag", undefined)).toBe(false);
  });
});

describe("parseQqbotTimestamp", () => {
  it("parses ISO strings", () => {
    expect(parseQqbotTimestamp("2026-01-01T00:00:00Z")).toBe(Date.parse("2026-01-01T00:00:00Z"));
  });

  it("parses epoch ms and epoch seconds", () => {
    expect(parseQqbotTimestamp(1767225600000)).toBe(1767225600000);
    expect(parseQqbotTimestamp(1767225600)).toBe(1767225600000);
    expect(parseQqbotTimestamp("1767225600000")).toBe(1767225600000);
  });

  it("falls back to now for garbage input", () => {
    const before = Date.now();
    const parsed = parseQqbotTimestamp("not-a-timestamp");
    expect(parsed).toBeGreaterThanOrEqual(before);
  });
});

describe("isHandledQqbotEvent", () => {
  it("accepts the five supported message events only", () => {
    for (const eventType of [
      "AT_MESSAGE_CREATE",
      "MESSAGE_CREATE",
      "DIRECT_MESSAGE_CREATE",
      "C2C_MESSAGE_CREATE",
      "GROUP_AT_MESSAGE_CREATE",
    ]) {
      expect(isHandledQqbotEvent(eventType)).toBe(true);
    }
    expect(isHandledQqbotEvent("READY")).toBe(false);
    expect(isHandledQqbotEvent("AT_MESSAGE_REJECT")).toBe(false);
  });
});
