/**
 * Inbound payload normalization for the QQ official bot gateway (reference
 * adapter.py inbound handlers).
 *
 * Supported dispatch events:
 * - AT_MESSAGE_CREATE      guild public message (@bot required)
 * - MESSAGE_CREATE         guild message (private domain; may lack @)
 * - DIRECT_MESSAGE_CREATE  guild DM
 * - C2C_MESSAGE_CREATE     v2 direct message (openid)
 * - GROUP_AT_MESSAGE_CREATE v2 group message (openid)
 * Anything else returns null (unknown/unhandled type).
 */

import type { QqbotAttachment, QqbotChatKind, QqbotInboundMessage } from "./types.js";

const GUILD_EVENTS = new Set(["AT_MESSAGE_CREATE", "MESSAGE_CREATE"]);

/** QQ mention tags: <@!id> / <@id> — ids are numeric (guild) or openids (v2). */
const MENTION_TAG_PATTERN = /<@!?[A-Za-z0-9_-]+>/;

/** Strip a leading @bot mention (`<@!id>` / `<@id>`) plus surrounding whitespace. */
export function stripAtMention(content: string): string {
  let text = content.trim();
  // Repeatedly strip leading <@!123>/<@123> tokens (some clients stack mentions).
  for (;;) {
    const next = text.replace(new RegExp(`^${MENTION_TAG_PATTERN.source}\\s*`), "");
    if (next === text) {
      break;
    }
    text = next.trim();
  }
  // Legacy fallback from the reference: leading plain "@name " prefixes.
  return text.replace(/^@\S+\s*/, "").trim();
}

/** True when the payload indicates the bot was mentioned. */
export function detectMention(content: string, mentions: unknown): boolean {
  if (Array.isArray(mentions) && mentions.length > 0) {
    return true;
  }
  return MENTION_TAG_PATTERN.test(content);
}

/** Parse a QQ timestamp (ISO 8601 string or epoch ms number) → epoch ms. */
export function parseQqbotTimestamp(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    // QQ sends epoch ms; guard against second-precision values.
    return raw > 1e12 ? Math.floor(raw) : Math.floor(raw * 1000);
  }
  if (typeof raw === "string" && raw.trim()) {
    const asNumber = Number(raw);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber > 1e12 ? Math.floor(asNumber) : Math.floor(asNumber * 1000);
    }
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Date.now();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string {
  return typeof value === "string"
    ? value
    : value === undefined || value === null
      ? ""
      : String(value);
}

function parseAttachments(value: unknown): QqbotAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: QqbotAttachment[] = [];
  for (const entry of value) {
    const att = asRecord(entry);
    const rawUrl = str(att.url).trim();
    if (!rawUrl) {
      continue;
    }
    out.push({
      contentType: str(att.content_type).trim(),
      // QQ CDN URLs often arrive protocol-relative ("//multimedia...").
      url: rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl,
      filename: str(att.filename).trim() || undefined,
    });
  }
  return out;
}

/**
 * Normalize a QQ gateway dispatch payload into a QqbotInboundMessage.
 * Returns null for unknown event types or malformed payloads (missing id).
 */
export function normalizeQqbotEvent(
  eventType: string,
  d: unknown,
  seq?: number,
): QqbotInboundMessage | null {
  const data = asRecord(d);
  const messageId = str(data.id).trim();
  if (!messageId) {
    return null;
  }
  const author = asRecord(data.author);
  const rawContent = str(data.content);
  const mentions = data.mentions;
  const attachments = parseAttachments(data.attachments);
  const timestamp = parseQqbotTimestamp(data.timestamp);

  const base = {
    eventType,
    messageId,
    attachments,
    timestamp,
    seq,
    raw: d,
  };

  if (eventType === "C2C_MESSAGE_CREATE") {
    const userOpenid = str(author.user_openid).trim();
    if (!userOpenid) {
      return null;
    }
    return {
      ...base,
      chatKind: "c2c",
      chatId: userOpenid,
      senderId: userOpenid,
      content: rawContent.trim(),
      rawContent,
      isMention: false,
    };
  }

  if (eventType === "GROUP_AT_MESSAGE_CREATE") {
    const groupOpenid = str(data.group_openid).trim();
    const memberOpenid = str(author.member_openid).trim();
    if (!groupOpenid || !memberOpenid) {
      return null;
    }
    return {
      ...base,
      chatKind: "group",
      chatId: groupOpenid,
      senderId: memberOpenid,
      content: stripAtMention(rawContent),
      rawContent,
      isMention: true,
    };
  }

  if (GUILD_EVENTS.has(eventType) || eventType === "DIRECT_MESSAGE_CREATE") {
    const isDirect = eventType === "DIRECT_MESSAGE_CREATE";
    const chatKind: QqbotChatKind = isDirect ? "dm" : "guild";
    const chatId = isDirect ? str(data.guild_id).trim() : str(data.channel_id).trim();
    const senderId = str(author.id).trim();
    if (!chatId || !senderId) {
      return null;
    }
    const member = asRecord(data.member);
    const isMention = GUILD_EVENTS.has(eventType) ? detectMention(rawContent, mentions) : false;
    return {
      ...base,
      chatKind,
      chatId,
      senderId,
      senderName: str(member.nick).trim() || str(author.username).trim() || undefined,
      content: isMention ? stripAtMention(rawContent) : rawContent.trim(),
      rawContent,
      isMention,
    };
  }

  // Unknown / unhandled dispatch type.
  return null;
}

/** Event types this adapter forwards to the agent runtime. */
export function isHandledQqbotEvent(eventType: string): boolean {
  return (
    GUILD_EVENTS.has(eventType) ||
    eventType === "DIRECT_MESSAGE_CREATE" ||
    eventType === "C2C_MESSAGE_CREATE" ||
    eventType === "GROUP_AT_MESSAGE_CREATE"
  );
}
