/**
 * Normalize decrypted WeCom callback XML into an inbound message
 * (port of hermes-agent `wecom_callback.py::_build_event`, extended with
 * image/voice normalization).
 */

import type { WecomInboundMessage } from "./types.js";
import { parseXmlEnvelope } from "./xml.js";

/**
 * Events that represent real user intake and may start an agent session.
 *
 * Everything else (`enter_agent`, `subscribe`, `change_contact`,
 * `batch_job_result`, `location_report`, ...) is a lifecycle/HR/batch event:
 * it is acknowledged by the callback handler but never starts an agent turn
 * and never replies to the event sender.
 */
const INTAKE_EVENTS = new Set(["click"]);

/**
 * Parse decrypted callback XML. Returns `null` for events that should be
 * acknowledged without an agent turn, or unparseable payloads.
 */
export function parseWecomMessage(xmlText: string): WecomInboundMessage | null {
  const fields = parseXmlEnvelope(xmlText);
  const msgType = (fields.MsgType ?? "").toLowerCase();
  const fromUserId = fields.FromUserName ?? "";
  const toUserName = fields.ToUserName ?? "";
  if (!msgType || !fromUserId) {
    return null;
  }

  // WeCom sends ChatType="group" for group callbacks and "chat" for DMs.
  const chatType: "direct" | "group" =
    (fields.ChatType ?? "").toLowerCase() === "group" ? "group" : "direct";

  const base = {
    fromUserId,
    toUserName,
    chatType,
    agentId: fields.AgentID || undefined,
    msgId: fields.MsgId || undefined,
    createTime: fields.CreateTime || undefined,
    rawXml: xmlText,
  };

  if (msgType === "event") {
    const eventName = (fields.Event ?? "").toLowerCase();
    if (!INTAKE_EVENTS.has(eventName)) {
      // Not an intake event: acknowledge silently, never start a session.
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
