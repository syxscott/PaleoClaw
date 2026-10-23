import { createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  WxBizMsgCrypt,
  WeComDecryptError,
  WeComSignatureError,
  decodePkcs7,
  encodePkcs7,
  randomNonce,
  sha1Signature,
} from "./crypto.js";

// Fixed test vectors — same construction as Tencent's WXBizMsgCrypt samples.
const TOKEN = "testtoken";
const AES_KEY_43 = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopq"; // 43 chars
const RECEIVE_ID = "ww1234567890abcdef";
const TIMESTAMP = "1409659813";
const NONCE = "nonce12345";
const RANDOM_PREFIX = Buffer.alloc(16, 0xab);

function makeCrypt(receiveId = RECEIVE_ID): WxBizMsgCrypt {
  return new WxBizMsgCrypt({
    token: TOKEN,
    encodingAesKey: AES_KEY_43,
    receiveId,
  });
}

describe("WXBizMsgCrypt (WeCom callback crypto)", () => {
  it("derives a 32-byte AES key and IV from the 43-char EncodingAESKey", () => {
    const crypt = makeCrypt();
    expect(crypt.key.length).toBe(32);
    expect(crypt.iv.length).toBe(16);
    expect(crypt.key.subarray(0, 16).equals(crypt.iv)).toBe(true);
  });

  it("rejects malformed constructor arguments", () => {
    expect(
      () => new WxBizMsgCrypt({ token: "", encodingAesKey: AES_KEY_43, receiveId: RECEIVE_ID }),
    ).toThrow("token is required");
    expect(
      () => new WxBizMsgCrypt({ token: TOKEN, encodingAesKey: "short", receiveId: RECEIVE_ID }),
    ).toThrow("43 chars");
    expect(
      () => new WxBizMsgCrypt({ token: TOKEN, encodingAesKey: AES_KEY_43, receiveId: "" }),
    ).toThrow("receive_id is required");
  });

  it("computes the SHA1 signature of sorted(token, timestamp, nonce, encrypt)", () => {
    // Sort "testtoken", "1409659813", "nonce12345", "abc" lexicographically:
    // 1409659813, abc, nonce12345, testtoken
    const expected = createHash("sha1")
      .update(["1409659813", "abc", "nonce12345", "testtoken"].join(""))
      .digest("hex");
    expect(sha1Signature(TOKEN, TIMESTAMP, NONCE, "abc")).toBe(expected);
  });

  it("round-trips encrypt → decrypt with a fixed random prefix", () => {
    const crypt = makeCrypt();
    const plaintext = "<xml><ToUserName>toUser</ToUserName><Content>你好，世界</Content></xml>";
    const encrypt = crypt.encrypt(plaintext, { randomPrefix: RANDOM_PREFIX });
    expect(encrypt).toMatch(/^[A-Za-z0-9+/=]+$/);

    const signature = sha1Signature(TOKEN, TIMESTAMP, NONCE, encrypt);
    const decrypted = crypt.decrypt(signature, TIMESTAMP, NONCE, encrypt);
    expect(decrypted.toString("utf8")).toBe(plaintext);
  });

  it("round-trips through the full encrypted envelope", () => {
    const crypt = makeCrypt();
    const plaintext = "<xml><MsgType>text</MsgType><Content>envelope-test</Content></xml>";
    const envelope = crypt.buildEncryptedEnvelope(plaintext, {
      nonce: NONCE,
      timestamp: TIMESTAMP,
      randomPrefix: RANDOM_PREFIX,
    });

    expect(envelope).toContain("<xml>");
    expect(envelope).toContain("<TimeStamp>1409659813</TimeStamp>");
    expect(envelope).toContain(`<Nonce>${NONCE}</Nonce>`);

    const encrypt = /<Encrypt>([^<]+)<\/Encrypt>/.exec(envelope)?.[1] ?? "";
    const signature = /<MsgSignature>([^<]+)<\/MsgSignature>/.exec(envelope)?.[1] ?? "";
    // The envelope signature must verify against the encrypted payload…
    expect(sha1Signature(TOKEN, TIMESTAMP, NONCE, encrypt)).toBe(signature);
    // …and the payload must decrypt back to the plaintext.
    expect(crypt.decrypt(signature, TIMESTAMP, NONCE, encrypt).toString("utf8")).toBe(plaintext);
  });

  it("verifyUrl decrypts the echo string to plaintext", () => {
    const crypt = makeCrypt();
    const plaintext = "echo-plaintext-7543";
    const echostr = crypt.encrypt(plaintext, { randomPrefix: RANDOM_PREFIX });
    const signature = sha1Signature(TOKEN, TIMESTAMP, NONCE, echostr);
    expect(crypt.verifyUrl(signature, TIMESTAMP, NONCE, echostr)).toBe(plaintext);
  });

  it("rejects a tampered signature", () => {
    const crypt = makeCrypt();
    const encrypt = crypt.encrypt("hello", { randomPrefix: RANDOM_PREFIX });
    expect(() => crypt.decrypt("deadbeef".repeat(5), TIMESTAMP, NONCE, encrypt)).toThrow(
      WeComSignatureError,
    );
  });

  it("rejects a receive_id mismatch", () => {
    const crypt = makeCrypt();
    const otherCrypt = makeCrypt("ww_other_corp_id");
    const plaintext = "<xml><Content>hi</Content></xml>";
    const encrypt = otherCrypt.encrypt(plaintext, { randomPrefix: RANDOM_PREFIX });
    const signature = sha1Signature(TOKEN, TIMESTAMP, NONCE, encrypt);
    // Signature is valid (same token), but the payload is sealed for another corp.
    expect(() => crypt.decrypt(signature, TIMESTAMP, NONCE, encrypt)).toThrow(
      "receive_id mismatch",
    );
  });

  it("rejects malformed base64 payloads", () => {
    const crypt = makeCrypt();
    const signature = sha1Signature(TOKEN, TIMESTAMP, NONCE, "!!not-base64!!");
    expect(() => crypt.decrypt(signature, TIMESTAMP, NONCE, "!!not-base64!!")).toThrow(
      WeComDecryptError,
    );
  });

  it("rejects ciphertext that is not a multiple of the AES block size", () => {
    const crypt = makeCrypt();
    const encrypt = Buffer.alloc(20, 1).toString("base64");
    const signature = sha1Signature(TOKEN, TIMESTAMP, NONCE, encrypt);
    expect(() => crypt.decrypt(signature, TIMESTAMP, NONCE, encrypt)).toThrow(
      "ciphertext length is not a multiple of the AES block size",
    );
  });

  it("rejects invalid PKCS7 padding", () => {
    const crypt = makeCrypt();
    // Encrypt 32 zero bytes: valid AES block, invalid PKCS7(32) padding (pad=0).
    const cipher = createCipheriv("aes-256-cbc", crypt.key, crypt.iv);
    cipher.setAutoPadding(false);
    const zeros = Buffer.alloc(32, 0);
    const encrypt = Buffer.concat([cipher.update(zeros), cipher.final()]).toString("base64");
    const signature = sha1Signature(TOKEN, TIMESTAMP, NONCE, encrypt);
    expect(() => crypt.decrypt(signature, TIMESTAMP, NONCE, encrypt)).toThrow(
      "invalid PKCS7 padding",
    );
  });

  it("rejects a message length header that exceeds the payload", () => {
    const crypt = makeCrypt();
    // random(16) + len=0xffffffff + no body
    const plain = Buffer.alloc(20);
    plain.writeUInt32BE(0xffffffff, 16);
    const padded = encodePkcs7(plain);
    const cipher = createCipheriv("aes-256-cbc", crypt.key, crypt.iv);
    cipher.setAutoPadding(false);
    const encrypt = Buffer.concat([cipher.update(padded), cipher.final()]).toString("base64");
    const signature = sha1Signature(TOKEN, TIMESTAMP, NONCE, encrypt);
    expect(() => crypt.decrypt(signature, TIMESTAMP, NONCE, encrypt)).toThrow(
      "message length header exceeds payload size",
    );
  });

  it("handles 32-byte PKCS7 padding round-trip including the aligned case", () => {
    // 32 bytes of content → 32 bytes of padding (amount_to_pad == 0 case).
    const content = Buffer.alloc(32, 0x41);
    const padded = encodePkcs7(content);
    expect(padded.length).toBe(64);
    expect(decodePkcs7(padded).equals(content)).toBe(true);

    // Padding byte > 32 is invalid under the WeCom 32-byte block.
    expect(() => decodePkcs7(Buffer.alloc(16, 33))).toThrow(WeComDecryptError);
  });

  it("generates random nonces from the alphanumeric alphabet", () => {
    for (const length of [1, 10, 32]) {
      const nonce = randomNonce(length);
      expect(nonce.length).toBe(length);
      expect(nonce).toMatch(/^[0-9a-zA-Z]+$/);
    }
  });

  it("produces ciphertext decryptable by raw node crypto (interoperability)", () => {
    // Cross-check: our encrypted payload can be decrypted with plain
    // node:crypto AES-256-CBC + manual 32-byte PKCS7 strip.
    const crypt = makeCrypt();
    const plaintext = "interoperability-check";
    const encrypt = crypt.encrypt(plaintext, { randomPrefix: RANDOM_PREFIX });
    const decipher = createDecipheriv("aes-256-cbc", crypt.key, crypt.iv);
    decipher.setAutoPadding(false);
    const padded = Buffer.concat([
      decipher.update(Buffer.from(encrypt, "base64")),
      decipher.final(),
    ]);
    const pad = padded[padded.length - 1];
    expect(pad).toBeGreaterThanOrEqual(1);
    expect(pad).toBeLessThanOrEqual(32);
    const plain = padded.subarray(0, padded.length - pad);
    // random(16) | len(4) | msg | receiveId
    const msgLen = plain.readUInt32BE(16);
    expect(plain.subarray(20, 20 + msgLen).toString("utf8")).toBe(plaintext);
    expect(plain.subarray(20 + msgLen).toString("utf8")).toBe(RECEIVE_ID);
  });
});
