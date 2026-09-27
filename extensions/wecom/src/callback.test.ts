import { describe, expect, it } from "vitest";
import { createWecomCallbackHandler } from "./callback.js";
import { sha1Signature, WxBizMsgCrypt } from "./crypto.js";
import { flushAsync, makeReq, makeRes } from "./test-http-utils.js";
import type { ResolvedWecomAccount } from "./types.js";
import type { WecomInboundMessage } from "./types.js";
import { buildXmlEnvelope } from "./xml.js";

// Fixed vectors (same construction as crypto.test.ts).
const TOKEN = "testtoken";
const AES_KEY_43 = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopq";
const CORP_ID = "ww1234567890abcdef";
const TIMESTAMP = "1409659813";
const NONCE = "nonce12345";
const RANDOM_PREFIX = Buffer.alloc(16, 0xab);

function makeAccount(overrides: Partial<ResolvedWecomAccount> = {}): ResolvedWecomAccount {
  return {
    accountId: "default",
    enabled: true,
    corpId: CORP_ID,
    agentId: "1000002",
    secret: "test-secret",
    token: TOKEN,
    encodingAesKey: AES_KEY_43,
    callbackPath: "/wecom/callback",
    dmPolicy: "allowlist",
    allowFrom: ["zhangsan"],
    outboundMsgType: "text",
    configured: true,
    ...overrides,
  };
}

function makeCrypt(): WxBizMsgCrypt {
  return new WxBizMsgCrypt({
    token: TOKEN,
    encodingAesKey: AES_KEY_43,
    receiveId: CORP_ID,
  });
}

function makeGetUrl(params: Record<string, string>): string {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return `/wecom/callback?${qs}`;
}

describe("WeCom callback handler", () => {
  it("GET echo verification returns the decrypted plaintext", async () => {
    const crypt = makeCrypt();
    const plaintext = "echo-plaintext-7543";
    const echostr = crypt.encrypt(plaintext, { randomPrefix: RANDOM_PREFIX });
    const signature = sha1Signature(TOKEN, TIMESTAMP, NONCE, echostr);

    const delivered: WecomInboundMessage[] = [];
    const { handler } = createWecomCallbackHandler({
      account: makeAccount(),
      deliver: (message) => {
        delivered.push(message);
      },
    });

    const res = makeRes();
    await handler(
      makeReq(
        "GET",
        makeGetUrl({
          msg_signature: signature,
          timestamp: TIMESTAMP,
          nonce: NONCE,
          echostr,
        }),
      ),
      res,
    );

    expect(res._status).toBe(200);
    expect(res._body).toBe(plaintext);
    expect(delivered).toHaveLength(0);
  });

  it("GET echo verification rejects a bad signature with 403", async () => {
    const crypt = makeCrypt();
    const echostr = crypt.encrypt("secret", { randomPrefix: RANDOM_PREFIX });
    const { handler } = createWecomCallbackHandler({
      account: makeAccount(),
      deliver: () => {},
    });

    const res = makeRes();
    await handler(
      makeReq(
        "GET",
        makeGetUrl({
          msg_signature: "0".repeat(40),
          timestamp: TIMESTAMP,
          nonce: NONCE,
          echostr,
        }),
      ),
      res,
    );
    expect(res._status).toBe(403);
  });

  it("POST encrypted text callback decrypts, acknowledges, and delivers", async () => {
    const crypt = makeCrypt();
    const messageXml = buildXmlEnvelope({
      ToUserName: CORP_ID,
      FromUserName: "zhangsan",
      CreateTime: "1700000000",
      MsgType: "text",
      Content: "hello bot",
      MsgId: "900001",
    });
    const body = crypt.buildEncryptedEnvelope(messageXml, {
      nonce: NONCE,
      timestamp: TIMESTAMP,
      randomPrefix: RANDOM_PREFIX,
    });
    const encrypt = /<Encrypt>([^<]+)<\/Encrypt>/.exec(body)?.[1] ?? "";
    const signature = /<MsgSignature>([^<]+)<\/MsgSignature>/.exec(body)?.[1] ?? "";

    const delivered: WecomInboundMessage[] = [];
    const { handler } = createWecomCallbackHandler({
      account: makeAccount(),
      deliver: (message) => {
        delivered.push(message);
      },
    });

    const res = makeRes();
    await handler(
      makeReq(
        "POST",
        makeGetUrl({ msg_signature: signature, timestamp: TIMESTAMP, nonce: NONCE }),
        body,
      ),
      res,
    );

    // WeCom requires an immediate 200 "success" acknowledgement.
    expect(res._status).toBe(200);
    expect(res._body).toBe("success");

    await flushAsync();
    expect(delivered).toHaveLength(1);
    expect(delivered[0]?.content).toBe("hello bot");
    expect(delivered[0]?.fromUserId).toBe("zhangsan");
    expect(delivered[0]?.msgId).toBe("900001");
  });

  it("POST with a valid but redelivered MsgId is deduplicated", async () => {
    const crypt = makeCrypt();
    const messageXml = buildXmlEnvelope({
      FromUserName: "zhangsan",
      MsgType: "text",
      Content: "once only",
      MsgId: "900002",
    });
    const body = crypt.buildEncryptedEnvelope(messageXml, {
      nonce: NONCE,
      timestamp: TIMESTAMP,
      randomPrefix: RANDOM_PREFIX,
    });
    const encrypt = /<Encrypt>([^<]+)<\/Encrypt>/.exec(body)?.[1] ?? "";
    const signature = /<MsgSignature>([^<]+)<\/MsgSignature>/.exec(body)?.[1] ?? "";

    const delivered: WecomInboundMessage[] = [];
    const { handler } = createWecomCallbackHandler({
      account: makeAccount(),
      deliver: (message) => {
        delivered.push(message);
      },
    });

    for (let i = 0; i < 2; i++) {
      const res = makeRes();
      await handler(
        makeReq(
          "POST",
          makeGetUrl({ msg_signature: signature, timestamp: TIMESTAMP, nonce: NONCE }),
          body,
        ),
        res,
      );
      expect(res._status).toBe(200);
    }

    await flushAsync();
    expect(delivered).toHaveLength(1);
  });

  it("POST subscribe event is acknowledged but not delivered", async () => {
    const crypt = makeCrypt();
    const messageXml = buildXmlEnvelope({
      FromUserName: "zhangsan",
      MsgType: "event",
      Event: "subscribe",
    });
    const body = crypt.buildEncryptedEnvelope(messageXml, {
      nonce: NONCE,
      timestamp: TIMESTAMP,
      randomPrefix: RANDOM_PREFIX,
    });
    const encrypt = /<Encrypt>([^<]+)<\/Encrypt>/.exec(body)?.[1] ?? "";
    const signature = /<MsgSignature>([^<]+)<\/MsgSignature>/.exec(body)?.[1] ?? "";

    const delivered: WecomInboundMessage[] = [];
    const { handler } = createWecomCallbackHandler({
      account: makeAccount(),
      deliver: (message) => {
        delivered.push(message);
      },
    });

    const res = makeRes();
    await handler(
      makeReq(
        "POST",
        makeGetUrl({ msg_signature: signature, timestamp: TIMESTAMP, nonce: NONCE }),
        body,
      ),
      res,
    );

    expect(res._status).toBe(200);
    expect(res._body).toBe("success");
    await flushAsync();
    expect(delivered).toHaveLength(0);
  });

  it("POST with a bad signature is rejected with 400", async () => {
    const crypt = makeCrypt();
    const messageXml = buildXmlEnvelope({
      FromUserName: "zhangsan",
      MsgType: "text",
      Content: "nope",
      MsgId: "900003",
    });
    const body = crypt.buildEncryptedEnvelope(messageXml, {
      nonce: NONCE,
      timestamp: TIMESTAMP,
      randomPrefix: RANDOM_PREFIX,
    });

    const delivered: WecomInboundMessage[] = [];
    const { handler } = createWecomCallbackHandler({
      account: makeAccount(),
      deliver: (message) => {
        delivered.push(message);
      },
    });

    const res = makeRes();
    await handler(
      makeReq(
        "POST",
        makeGetUrl({ msg_signature: "f".repeat(40), timestamp: TIMESTAMP, nonce: NONCE }),
        body,
      ),
      res,
    );
    expect(res._status).toBe(400);
    await flushAsync();
    expect(delivered).toHaveLength(0);
  });

  it("rejects unsupported HTTP methods with 405", async () => {
    const { handler } = createWecomCallbackHandler({
      account: makeAccount(),
      deliver: () => {},
    });
    const res = makeRes();
    await handler(makeReq("DELETE", "/wecom/callback"), res);
    expect(res._status).toBe(405);
  });
});
