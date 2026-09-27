import { describe, expect, it } from "vitest";
import { buildXmlEnvelope, decodeXmlEntities, parseXmlEnvelope } from "./xml.js";

describe("parseXmlEnvelope (WeCom callback XML)", () => {
  it("parses the official WeCom text-message sample with CDATA fields", () => {
    const xml =
      "<xml><ToUserName><![CDATA[toUser]]></ToUserName>" +
      "<FromUserName><![CDATA[fromUser]]></FromUserName>" +
      "<CreateTime>1348831860</CreateTime>" +
      "<MsgType><![CDATA[text]]></MsgType>" +
      "<Content><![CDATA[this is a test]]></Content>" +
      "<MsgId>1234567890123456</MsgId>" +
      "<AgentID>1</AgentID></xml>";

    const fields = parseXmlEnvelope(xml);
    expect(fields.ToUserName).toBe("toUser");
    expect(fields.FromUserName).toBe("fromUser");
    expect(fields.CreateTime).toBe("1348831860");
    expect(fields.MsgType).toBe("text");
    expect(fields.Content).toBe("this is a test");
    expect(fields.MsgId).toBe("1234567890123456");
    expect(fields.AgentID).toBe("1");
  });

  it("parses the encrypted callback envelope", () => {
    const xml =
      "<xml><Encrypt><![CDATA[ENCRYPT_B64==]]></Encrypt>" +
      "<MsgSignature>a1b2c3d4</MsgSignature>" +
      "<TimeStamp>1700000000</TimeStamp>" +
      "<Nonce>nonce</Nonce></xml>";
    const fields = parseXmlEnvelope(xml);
    expect(fields.Encrypt).toBe("ENCRYPT_B64==");
    expect(fields.MsgSignature).toBe("a1b2c3d4");
    expect(fields.TimeStamp).toBe("1700000000");
    expect(fields.Nonce).toBe("nonce");
  });

  it("decodes XML entities in plain text nodes", () => {
    const fields = parseXmlEnvelope("<xml><Content>a&lt;b &amp; c&gt;d&quot;e</Content></xml>");
    expect(fields.Content).toBe('a<b & c>d"e');
  });

  it("decodes numeric and hex entities", () => {
    expect(decodeXmlEntities("&#48;&#x41;")).toBe("0A");
  });

  it("tolerates an XML declaration, comments, and self-closing tags", () => {
    const xml = '<?xml version="1.0"?><!-- comment --><xml><A>1</A><B/><C>3</C></xml>';
    const fields = parseXmlEnvelope(xml);
    expect(fields.A).toBe("1");
    expect(fields.C).toBe("3");
  });

  it("returns an empty record for garbage input", () => {
    expect(parseXmlEnvelope("not xml at all")).toEqual({});
    expect(parseXmlEnvelope("")).toEqual({});
  });
});

describe("buildXmlEnvelope", () => {
  it("escapes text and round-trips through the parser", () => {
    const xml = buildXmlEnvelope({
      Content: "a<b & c>d",
      MsgId: 42,
    });
    expect(xml).toBe("<xml><Content>a&lt;b &amp; c&gt;d</Content><MsgId>42</MsgId></xml>");
    const parsed = parseXmlEnvelope(xml);
    expect(parsed.Content).toBe("a<b & c>d");
    expect(parsed.MsgId).toBe("42");
  });
});
