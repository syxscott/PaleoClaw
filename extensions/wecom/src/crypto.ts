/**
 * WeCom (企业微信) callback message crypto — TypeScript port of the classic
 * Tencent `WXBizMsgCrypt` wire format (ported from hermes-agent
 * `gateway/platforms/wecom_crypto.py`).
 *
 * Wire layout of a decrypted payload:
 *   random(16) | msg_len(4, big-endian) | xml_bytes | receive_id
 *
 * - Signature: SHA1 hex of sorted([token, timestamp, nonce, encrypt]) joined.
 * - Cipher: AES-256-CBC, key = base64decode(43-char EncodingAESKey + "="),
 *   IV = first 16 bytes of the key.
 * - Padding: PKCS7 with a 32-byte block (WeCom-specific, NOT the cipher's 16).
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export class WeComCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeComCryptoError";
  }
}

export class WeComSignatureError extends WeComCryptoError {
  constructor(message = "signature mismatch") {
    super(message);
    this.name = "WeComSignatureError";
  }
}

export class WeComDecryptError extends WeComCryptoError {
  constructor(message = "decrypt failed") {
    super(message);
    this.name = "WeComDecryptError";
  }
}

export class WeComEncryptError extends WeComCryptoError {
  constructor(message = "encrypt failed") {
    super(message);
    this.name = "WeComEncryptError";
  }
}

export const WECOM_PKCS7_BLOCK_SIZE = 32;
export const WECOM_ENCODING_AES_KEY_LENGTH = 43;
const RANDOM_PREFIX_BYTES = 16;
const MSG_LEN_BYTES = 4;
const NONCE_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** SHA1 signature of the lexicographically sorted token/timestamp/nonce/encrypt tuple. */
export function sha1Signature(
  token: string,
  timestamp: string,
  nonce: string,
  encrypt: string,
): string {
  const parts = [token, timestamp, nonce, encrypt].sort();
  return createHash("sha1").update(parts.join(""), "utf8").digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** PKCS7 padding with a 32-byte block (pads even when already aligned). */
export function encodePkcs7(text: Buffer, blockSize = WECOM_PKCS7_BLOCK_SIZE): Buffer {
  let amountToPad = blockSize - (text.length % blockSize);
  if (amountToPad === 0) {
    amountToPad = blockSize;
  }
  return Buffer.concat([text, Buffer.alloc(amountToPad, amountToPad)]);
}

/** Strip and validate 32-byte-block PKCS7 padding. */
export function decodePkcs7(decrypted: Buffer, blockSize = WECOM_PKCS7_BLOCK_SIZE): Buffer {
  if (!decrypted || decrypted.length === 0) {
    throw new WeComDecryptError("empty decrypted payload");
  }
  const pad = decrypted[decrypted.length - 1];
  if (pad < 1 || pad > blockSize) {
    throw new WeComDecryptError("invalid PKCS7 padding");
  }
  const padding = decrypted.subarray(decrypted.length - pad);
  for (const byte of padding) {
    if (byte !== pad) {
      throw new WeComDecryptError("malformed PKCS7 padding");
    }
  }
  return decrypted.subarray(0, decrypted.length - pad);
}

export function randomNonce(length = 10): string {
  const out = new Array<string>(length);
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    out[i] = NONCE_ALPHABET[bytes[i] % NONCE_ALPHABET.length];
  }
  return out.join("");
}

export type WxBizMsgCryptOptions = {
  token: string;
  /** 43-character Base64 EncodingAESKey from the WeCom callback config. */
  encodingAesKey: string;
  /** CorpId (or other receive-id) expected as the payload suffix. */
  receiveId: string;
};

export type EncryptEnvelopeOptions = {
  nonce?: string;
  timestamp?: string;
  /** Injectable 16-byte random prefix (deterministic tests). */
  randomPrefix?: Buffer;
};

/**
 * Minimal WeCom callback crypto helper compatible with BizMsgCrypt semantics.
 * Ported faithfully from `wecom_crypto.py::WXBizMsgCrypt`.
 */
export class WxBizMsgCrypt {
  readonly token: string;
  readonly receiveId: string;
  readonly key: Buffer;
  readonly iv: Buffer;

  constructor(options: WxBizMsgCryptOptions) {
    const { token, encodingAesKey, receiveId } = options;
    if (!token) {
      throw new Error("token is required");
    }
    if (!encodingAesKey) {
      throw new Error("encoding_aes_key is required");
    }
    if (encodingAesKey.length !== WECOM_ENCODING_AES_KEY_LENGTH) {
      throw new Error("encoding_aes_key must be 43 chars");
    }
    if (!receiveId) {
      throw new Error("receive_id is required");
    }

    this.token = token;
    this.receiveId = receiveId;
    this.key = Buffer.from(encodingAesKey + "=", "base64");
    if (this.key.length !== 32) {
      throw new Error(`encoding_aes_key must decode to 32 bytes (got ${this.key.length})`);
    }
    this.iv = this.key.subarray(0, 16);
  }

  /** GET echo verification: decrypt `echostr` and return the plaintext. */
  verifyUrl(msgSignature: string, timestamp: string, nonce: string, echostr: string): string {
    return this.decrypt(msgSignature, timestamp, nonce, echostr).toString("utf8");
  }

  /**
   * Verify the callback signature, decrypt the base64 payload, and return the
   * inner XML bytes (random prefix, length header and receive_id stripped).
   */
  decrypt(msgSignature: string, timestamp: string, nonce: string, encrypt: string): Buffer {
    const expected = sha1Signature(this.token, timestamp, nonce, encrypt);
    if (!constantTimeEquals(expected, msgSignature)) {
      throw new WeComSignatureError();
    }

    let cipherText: Buffer;
    try {
      cipherText = Buffer.from(encrypt, "base64");
    } catch (error) {
      throw new WeComDecryptError(`invalid base64 payload: ${String(error)}`);
    }
    if (cipherText.length === 0 || cipherText.length % 16 !== 0) {
      throw new WeComDecryptError("ciphertext length is not a multiple of the AES block size");
    }

    let plain: Buffer;
    let content: Buffer;
    try {
      const decipher = createDecipheriv("aes-256-cbc", this.key, this.iv);
      decipher.setAutoPadding(false);
      const padded = Buffer.concat([decipher.update(cipherText), decipher.final()]);
      plain = decodePkcs7(padded);
      content = plain.subarray(RANDOM_PREFIX_BYTES); // skip 16-byte random prefix
    } catch (error) {
      if (error instanceof WeComCryptoError) {
        throw error;
      }
      throw new WeComDecryptError(`decrypt failed: ${String(error)}`);
    }

    if (content.length < MSG_LEN_BYTES) {
      throw new WeComDecryptError("payload too short for message length header");
    }
    const xmlLength = content.readUInt32BE(0);
    if (MSG_LEN_BYTES + xmlLength > content.length) {
      throw new WeComDecryptError("message length header exceeds payload size");
    }
    const xmlContent = content.subarray(MSG_LEN_BYTES, MSG_LEN_BYTES + xmlLength);
    const receiveId = content.subarray(MSG_LEN_BYTES + xmlLength).toString("utf8");
    if (receiveId !== this.receiveId) {
      throw new WeComDecryptError("receive_id mismatch");
    }
    return xmlContent;
  }

  /** Encrypt raw bytes into the base64 `Encrypt` field value. */
  encryptBytes(raw: Buffer, options: EncryptEnvelopeOptions = {}): string {
    try {
      const randomPrefix = options.randomPrefix ?? randomBytes(RANDOM_PREFIX_BYTES);
      if (randomPrefix.length !== RANDOM_PREFIX_BYTES) {
        throw new Error("random prefix must be 16 bytes");
      }
      const msgLen = Buffer.alloc(MSG_LEN_BYTES);
      msgLen.writeUInt32BE(raw.length, 0);
      const payload = Buffer.concat([
        randomPrefix,
        msgLen,
        raw,
        Buffer.from(this.receiveId, "utf8"),
      ]);
      const padded = encodePkcs7(payload);
      const cipher = createCipheriv("aes-256-cbc", this.key, this.iv);
      cipher.setAutoPadding(false);
      const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
      return encrypted.toString("base64");
    } catch (error) {
      if (error instanceof WeComCryptoError) {
        throw error;
      }
      throw new WeComEncryptError(`encrypt failed: ${String(error)}`);
    }
  }

  /** Encrypt a plaintext string (UTF-8). */
  encrypt(plaintext: string, options: EncryptEnvelopeOptions = {}): string {
    return this.encryptBytes(Buffer.from(plaintext, "utf8"), options);
  }

  /**
   * Build the full reply envelope:
   * `<xml><Encrypt>..</Encrypt><MsgSignature>..</MsgSignature><TimeStamp>..</TimeStamp><Nonce>..</Nonce></xml>`
   */
  buildEncryptedEnvelope(plaintext: string, options: EncryptEnvelopeOptions = {}): string {
    const nonce = options.nonce ?? randomNonce();
    const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
    const encrypt = this.encrypt(plaintext, options);
    const signature = sha1Signature(this.token, timestamp, nonce, encrypt);
    return (
      `<xml><Encrypt>${encrypt}</Encrypt>` +
      `<MsgSignature>${signature}</MsgSignature>` +
      `<TimeStamp>${timestamp}</TimeStamp>` +
      `<Nonce>${nonce}</Nonce></xml>`
    );
  }
}
