import { describe, expect, it } from "vitest";
import { parseWecomMessage } from "./normalize.js";
import { buildXmlEnvelope } from "./xml.js";

describe("parseWecomMessage (inbound normalization)", () => {
  it("normalizes a text message", () => {
    const xml = buildXmlEnvelope({
      ToUserName: "wwcorp",
      FromUserName: "zhangsan",
      CreateTime: "1700000000",
      MsgType: "text",
      Content: "  你好  ",
      MsgId: "1234567890123456",
      AgentID: "1000002",
    });
    const message = parseWecomMessage(xml);
    expect(message).not.toBeNull();
    expect(message?.kind).toBe("message");
    expect(message?.msgType).toBe("text");
    expect(message?.fromUserId).toBe("zhangsan");
    expect(message?.toUserName).toBe("wwcorp");
    expect(message?.content).toBe("你好");
    expect(message?.msgId).toBe("1234567890123456");
    expect(message?.agentId).toBe("1000002");
    expect(message?.rawXml).toBe(xml);
  });

  it("normalizes an image message", () => {
    const xml = buildXmlEnvelope({
      FromUserName: "lisi",
      MsgType: "image",
      PicUrl: "https://example.com/x.jpg",
      MediaId: "MEDIA_ID",
      MsgId: "1",
    });
    const message = parseWecomMessage(xml);
    expect(message?.msgType).toBe("image");
    expect(message?.picUrl).toBe("https://example.com/x.jpg");
    expect(message?.mediaId).toBe("MEDIA_ID");
  });

  it("normalizes a voice message with format and recognition", () => {
    const xml = buildXmlEnvelope({
      FromUserName: "wangwu",
      MsgType: "voice",
      MediaId: "VOICE_MEDIA",
      Format: "amr",
      Recognition: "你好世界",
      MsgId: "2",
    });
    const message = parseWecomMessage(xml);
    expect(message?.msgType).toBe("voice");
    expect(message?.mediaId).toBe("VOICE_MEDIA");
    expect(message?.voiceFormat).toBe("amr");
    expect(message?.recognition).toBe("你好世界");
  });

  it("returns null for lifecycle events (enter_agent / subscribe)", () => {
    for (const event of ["enter_agent", "subscribe"]) {
      const xml = buildXmlEnvelope({
        FromUserName: "zhangsan",
        MsgType: "event",
        Event: event,
      });
      expect(parseWecomMessage(xml)).toBeNull();
    }
  });

  it("normalizes other events with a /start content substitution", () => {
    const xml = buildXmlEnvelope({
      FromUserName: "zhangsan",
      MsgType: "event",
      Event: "click",
      EventKey: "MENU_KEY",
    });
    const message = parseWecomMessage(xml);
    expect(message?.kind).toBe("event");
    expect(message?.eventName).toBe("click");
    expect(message?.eventKey).toBe("MENU_KEY");
    expect(message?.content).toBe("/start");
  });

  it("returns null for non-intake events (change_contact / batch_job_result)", () => {
    for (const event of ["change_contact", "batch_job_result", "location_report"]) {
      const xml = buildXmlEnvelope({
        FromUserName: "zhangsan",
        MsgType: "event",
        Event: event,
        EventKey: "KEY",
      });
      expect(parseWecomMessage(xml)).toBeNull();
    }
  });

  it("marks group callbacks as group chat", () => {
    const groupXml = buildXmlEnvelope({
      FromUserName: "zhangsan",
      MsgType: "text",
      Content: "hi team",
      MsgId: "3",
      ChatType: "group",
    });
    expect(parseWecomMessage(groupXml)?.chatType).toBe("group");

    const directXml = buildXmlEnvelope({
      FromUserName: "zhangsan",
      MsgType: "text",
      Content: "hi",
      MsgId: "4",
      ChatType: "chat",
    });
    expect(parseWecomMessage(directXml)?.chatType).toBe("direct");

    const noChatTypeXml = buildXmlEnvelope({
      FromUserName: "zhangsan",
      MsgType: "text",
      Content: "hi",
      MsgId: "5",
    });
    expect(parseWecomMessage(noChatTypeXml)?.chatType).toBe("direct");
  });

  it("keeps a message body whose CDATA contains a literal </Content>", () => {
    const xml =
      "<xml><FromUserName>zhangsan</FromUserName><MsgType>text</MsgType>" +
      "<Content><![CDATA[snippet: </Content> done]]></Content><MsgId>6</MsgId></xml>";
    const message = parseWecomMessage(xml);
    expect(message?.content).toBe("snippet: </Content> done");
  });

  it("returns null for payloads without MsgType or sender", () => {
    expect(parseWecomMessage("<xml><Content>hi</Content></xml>")).toBeNull();
    expect(parseWecomMessage(buildXmlEnvelope({ MsgType: "text", Content: "hi" }))).toBeNull();
  });

  it("returns null for unsupported message types (video/file)", () => {
    const xml = buildXmlEnvelope({ FromUserName: "a", MsgType: "video", MsgId: "9" });
    expect(parseWecomMessage(xml)).toBeNull();
  });
});
