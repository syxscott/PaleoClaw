/**
 * Normalize decrypted WeCom callback XML into an inbound message
 * (port of hermes-agent `wecom_callback.py::_build_event`, extended with
 * image/voice normalization).
 */

import type { WecomInboundMessage } from "./types.js";
import { parseXmlEnvelope } from "./xml.js";

/** Event names that are lifecycle pings: acknowledge silently, never dispatch. */
const SILENT_EVENTS = new Set(["enter_agent", "subscribe"]);

/**
 * Parse decrypted callback XML. Returns `null` for lifecycle events that
 * should be silently acknowledged (enter_agent / subscribe) or unparseable
 * payloads.
 */
export function parseWecomMessage(xmlText: string): WecomInboundMessage | null {
  const fields = parseXmlEnvelope(xmlText);
  const msgType = (fields.MsgType ?? "").toLowerCase();
  const fromUserId = fields.FromUserName ?? "";
  const toUserName = fields.ToUserName ?? "";
  if (!msgType || !fromUserId) {
    return null;
  }

  const base = {
    fromUserId,
    toUserName,
    agentId: fields.AgentID || undefined,
    msgId: fields.MsgId || undefined,
    createTime: fields.CreateTime || undefined,
    rawXml: xmlText,
  };

  if (msgType === "event") {
    const eventName = (fields.Event ?? "").toLowerCase();
    if (SILENT_EVENTS.has(eventName)) {
      return null;
    }
    return {
      ...base,
      kind: "event",
      msgType,
      eventName: eventName || undefined,
      eventKey: fields.EventKey || undefined,
      // Intake events substitute "/start" so the agent session starts.
      content: fields.Content?.trim() || "/start",
    };
  }

  if (msgType === "text") {
    return {
      ...base,
      kind: "message",
      msgType,
      content: (fields.Content ?? "").trim(),
    };
  }

  if (msgType === "image") {
    return {
      ...base,
      kind: "message",
      msgType,
      picUrl: fields.PicUrl || undefined,
      mediaId: fields.MediaId || undefined,
    };
  }

  if (msgType === "voice") {
    return {
      ...base,
      kind: "message",
      msgType,
      mediaId: fields.MediaId || undefined,
      voiceFormat: fields.Format || undefined,
      recognition: fields.Recognition || undefined,
    };
  }

  // Unsupported message types (video/file/location/...) are acknowledged but
  // not dispatched yet.
  return null;
}
