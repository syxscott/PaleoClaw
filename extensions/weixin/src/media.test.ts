import { createCipheriv, createDecipheriv } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  aes128EcbDecrypt,
  aes128EcbEncrypt,
  aesKeyForApi,
  buildCdnDownloadUrl,
  buildCdnUploadUrl,
  buildFileItem,
  buildGetUploadUrlPayload,
  buildImageItem,
  buildVideoItem,
  buildVoiceItem,
  generateMediaKeys,
  parseAesKey,
  pkcs7Pad,
} from "./media.js";

const KEY = Buffer.from("0123456789abcdef", "utf8"); // 16 bytes

describe("AES-128-ECB CDN media crypto", () => {
  it("round-trips encrypt → decrypt", () => {
    const plaintext = Buffer.from("媒体内容 media payload 🎉", "utf8");
    const ciphertext = aes128EcbEncrypt(plaintext, KEY);
    expect(ciphertext.length).toBeGreaterThan(0);
    expect(ciphertext.length % 16).toBe(0);
    expect(aes128EcbDecrypt(ciphertext, KEY).equals(plaintext)).toBe(true);
  });

  it("produces ciphertext decryptable by raw node crypto", () => {
    const plaintext = Buffer.from("interop", "utf8");
    const ciphertext = aes128EcbEncrypt(plaintext, KEY);
    const decipher = createDecipheriv("aes-128-ecb", KEY, null);
    decipher.setAutoPadding(false);
    const padded = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const pad = padded[padded.length - 1];
    expect(pad).toBeGreaterThanOrEqual(1);
    expect(pad).toBeLessThanOrEqual(16);
    expect(padded.subarray(0, padded.length - pad).equals(plaintext)).toBe(true);
  });

  it("pads with PKCS7(16), padding a full block when aligned", () => {
    expect(pkcs7Pad(Buffer.alloc(16)).length).toBe(32);
    expect(pkcs7Pad(Buffer.alloc(5)).length).toBe(16);
  });

  it("returns raw block output when padding is malformed (tolerant)", () => {
    // Decrypt a block of zeros: pad byte 0 is invalid → raw output returned.
    const cipher = createCipheriv("aes-128-ecb", KEY, null);
    cipher.setAutoPadding(false);
    const ciphertext = Buffer.concat([cipher.update(Buffer.alloc(16, 0)), cipher.final()]);
    expect(aes128EcbDecrypt(ciphertext, KEY).length).toBe(16);
  });

  it("rejects non-16-byte keys", () => {
    expect(() => aes128EcbEncrypt(Buffer.alloc(4), Buffer.alloc(15))).toThrow("16 bytes");
    expect(() => aes128EcbDecrypt(Buffer.alloc(16), Buffer.alloc(32))).toThrow("16 bytes");
  });
});

describe("parseAesKey", () => {
  it("accepts 16 raw bytes", () => {
    const raw = Buffer.from("0123456789abcdef", "utf8");
    expect(parseAesKey(raw.toString("base64")).equals(raw)).toBe(true);
  });

  it("accepts 32 ASCII hex chars encoded as base64", () => {
    const hex = "00112233445566778899aabbccddeeff";
    const encoded = Buffer.from(hex, "ascii").toString("base64");
    expect(parseAesKey(encoded).equals(Buffer.from(hex, "hex"))).toBe(true);
  });

  it("rejects unexpected lengths", () => {
    expect(() => parseAesKey(Buffer.alloc(8).toString("base64"))).toThrow(
      "unexpected aes_key format",
    );
  });
});

describe("media item builders (ported shapes)", () => {
  const params = {
    encryptQueryParam: "EQP",
    aesKeyHex: aesKeyForApi(Buffer.from("a".repeat(16), "utf8")),
    ciphertextSize: 128,
    plaintextSize: 100,
    filename: "report.pdf",
    rawfileMd5: "md5hash",
  };

  it("builds an image item with mid_size", () => {
    const item = buildImageItem(params);
    expect(item.type).toBe(2);
    const image = item.image_item as Record<string, any>;
    expect(image.mid_size).toBe(128);
    expect(image.media.encrypt_query_param).toBe("EQP");
    expect(image.media.encrypt_type).toBe(1);
    // aes_key must be base64(hex string), not base64(raw bytes)
    expect(image.media.aes_key).toBe(
      Buffer.from(Buffer.from("a".repeat(16)).toString("hex")).toString("base64"),
    );
  });

  it("builds a file item with file_name and len", () => {
    const item = buildFileItem(params);
    expect(item.type).toBe(4);
    const file = item.file_item as Record<string, any>;
    expect(file.file_name).toBe("report.pdf");
    expect(file.len).toBe("100");
  });

  it("builds video and voice items with their extra fields", () => {
    const video = buildVideoItem({ ...params, playLength: 12 }).video_item as Record<string, any>;
    expect(video.video_size).toBe(128);
    expect(video.play_length).toBe(12);
    expect(video.video_md5).toBe("md5hash");

    const voice = buildVoiceItem({
      ...params,
      encodeType: 6,
      sampleRate: 24000,
      bitsPerSample: 16,
      playLength: 5,
    }).voice_item as Record<string, any>;
    expect(voice.encode_type).toBe(6);
    expect(voice.sample_rate).toBe(24000);
    expect(voice.bits_per_sample).toBe(16);
    expect(voice.playtime).toBe(5);
  });

  it("builds the getuploadurl payload", () => {
    expect(
      buildGetUploadUrlPayload({
        filekey: "fk",
        mediaType: 1,
        toUserId: "peer",
        rawsize: 100,
        rawfilemd5: "md5",
        filesize: 112,
        aeskeyHex: "hex",
      }),
    ).toEqual({
      filekey: "fk",
      media_type: 1,
      to_user_id: "peer",
      rawsize: 100,
      rawfilemd5: "md5",
      filesize: 112,
      no_need_thumb: true,
      aeskey: "hex",
    });
  });

  it("builds CDN upload/download URLs", () => {
    expect(
      buildCdnUploadUrl({
        cdnBaseUrl: "https://novac2c.cdn.weixin.qq.com/c2c",
        uploadParam: "a b&c",
        filekey: "fk/1",
      }),
    ).toBe(
      "https://novac2c.cdn.weixin.qq.com/c2c/upload?encrypted_query_param=a%20b%26c&filekey=fk%2F1",
    );
    expect(
      buildCdnDownloadUrl({
        cdnBaseUrl: "https://novac2c.cdn.weixin.qq.com/c2c/",
        encryptedQueryParam: "x y",
      }),
    ).toBe("https://novac2c.cdn.weixin.qq.com/c2c/download?encrypted_query_param=x%20y");
  });

  it("generates 32-hex filekeys and 16-byte aes keys", () => {
    const { filekey, aesKey } = generateMediaKeys();
    expect(filekey).toMatch(/^[0-9a-f]{32}$/);
    expect(aesKey.length).toBe(16);
  });
});
