/**
 * Weixin CDN media helpers — port of the AES-128-ECB + media-item builders from
 * hermes-agent `weixin.py`.
 *
 * Media moves over Tencent's C2C CDN as AES-128-ECB ciphertext with PKCS7(16)
 * padding. Upload: `getuploadurl` → POST ciphertext → echo the returned
 * `x-encrypted-param` in the outbound item. Download: `encrypted_query_param`
 * → GET → decrypt with the item's `aes_key`.
 *
 * NOTE on constants (ported from the reference): `getuploadurl` media_type uses
 * MEDIA_* (image=1, video=2, file=3, voice=4) while `item_list` entry types use
 * ITEM_* (text=1, image=2, voice=3, file=4, video=5). The item builders below
 * emit ITEM_* types.
 */

import { createDecipheriv, createCipheriv, randomBytes } from "node:crypto";
import { ITEM_FILE, ITEM_IMAGE, ITEM_VIDEO, ITEM_VOICE } from "./ilink.js";

const BLOCK_SIZE = 16;

/** getuploadurl media_type values (distinct from item_list ITEM_* types). */
export const MEDIA_TYPE_IMAGE = 1;
export const MEDIA_TYPE_VIDEO = 2;
export const MEDIA_TYPE_FILE = 3;
export const MEDIA_TYPE_VOICE = 4;

export function pkcs7Pad(data: Buffer, blockSize = BLOCK_SIZE): Buffer {
  const padLen = blockSize - (data.length % blockSize);
  return Buffer.concat([data, Buffer.alloc(padLen, padLen)]);
}

/** AES-128-ECB encrypt with PKCS7(16) padding. Node forces no-padding mode + manual pad. */
export function aes128EcbEncrypt(plaintext: Buffer, key: Buffer): Buffer {
  if (key.length !== 16) {
    throw new Error(`aes key must be 16 bytes (got ${key.length})`);
  }
  const cipher = createCipheriv(`aes-128-ecb`, key, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(pkcs7Pad(plaintext)), cipher.final()]);
}

/**
 * AES-128-ECB decrypt; strips PKCS7 padding when well-formed, otherwise
 * returns the raw block output (tolerant — matches the Python port).
 */
export function aes128EcbDecrypt(ciphertext: Buffer, key: Buffer): Buffer {
  if (key.length !== 16) {
    throw new Error(`aes key must be 16 bytes (got ${key.length})`);
  }
  const decipher = createDecipheriv("aes-128-ecb", key, null);
  decipher.setAutoPadding(false);
  const padded = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const padLen = padded.length > 0 ? padded[padded.length - 1] : 0;
  if (
    padLen >= 1 &&
    padLen <= BLOCK_SIZE &&
    padded.subarray(padded.length - padLen).equals(Buffer.alloc(padLen, padLen))
  ) {
    return padded.subarray(0, padded.length - padLen);
  }
  return padded;
}

/**
 * Parse the CDN `aes_key`: 16 raw bytes, OR 32 ASCII hex chars → 16 bytes
 * (port of `_parse_aes_key`).
 */
export function parseAesKey(aesKeyB64: string): Buffer {
  const decoded = Buffer.from(aesKeyB64, "base64");
  if (decoded.length === 16) {
    return decoded;
  }
  if (decoded.length === 32) {
    const text = decoded.toString("latin1");
    if (/^[0-9a-fA-F]{32}$/.test(text)) {
      return Buffer.from(text, "hex");
    }
  }
  throw new Error(`unexpected aes_key format (${decoded.length} decoded bytes)`);
}

export type MediaItemParams = {
  encryptQueryParam: string;
  /** aes_key encoded for the API: base64(hex_string) — NOT base64(raw bytes). */
  aesKeyHex: string;
  ciphertextSize: number;
  plaintextSize: number;
  filename: string;
  rawfileMd5?: string;
  playLength?: number;
  encodeType?: number;
  sampleRate?: number;
  bitsPerSample?: number;
};

/** Build a voice item (port of `_voice_item` shape; item_list type = ITEM_VOICE=3). */
export function buildVoiceItem(params: MediaItemParams): Record<string, unknown> {
  return {
    type: ITEM_VOICE,
    voice_item: {
      media: {
        encrypt_query_param: params.encryptQueryParam,
        aes_key: params.aesKeyHex,
        encrypt_type: 1,
      },
      encode_type: params.encodeType,
      bits_per_sample: params.bitsPerSample,
      sample_rate: params.sampleRate,
      playtime: params.playLength ?? 0,
    },
  };
}

/** Build an image item (port of `_image_item` shape; item_list type = ITEM_IMAGE=2). */
export function buildImageItem(params: MediaItemParams): Record<string, unknown> {
  return {
    type: ITEM_IMAGE,
    image_item: {
      media: {
        encrypt_query_param: params.encryptQueryParam,
        aes_key: params.aesKeyHex,
        encrypt_type: 1,
      },
      mid_size: params.ciphertextSize,
    },
  };
}

/** Build a file item (port of `_file_item` shape; item_list type = ITEM_FILE=4). */
export function buildFileItem(params: MediaItemParams): Record<string, unknown> {
  return {
    type: ITEM_FILE,
    file_item: {
      media: {
        encrypt_query_param: params.encryptQueryParam,
        aes_key: params.aesKeyHex,
        encrypt_type: 1,
      },
      file_name: params.filename,
      len: String(params.plaintextSize),
    },
  };
}

/** Build a video item (port of `_video_item` shape; item_list type = ITEM_VIDEO=5). */
export function buildVideoItem(params: MediaItemParams): Record<string, unknown> {
  return {
    type: ITEM_VIDEO,
    video_item: {
      media: {
        encrypt_query_param: params.encryptQueryParam,
        aes_key: params.aesKeyHex,
        encrypt_type: 1,
      },
      video_size: params.ciphertextSize,
      play_length: params.playLength ?? 0,
      video_md5: params.rawfileMd5 ?? "",
    },
  };
}

/** Build the getuploadurl request payload (port of `_get_upload_url`). */
export function buildGetUploadUrlPayload(params: {
  filekey: string;
  mediaType: number;
  toUserId: string;
  rawsize: number;
  rawfilemd5: string;
  filesize: number;
  aeskeyHex: string;
}): Record<string, unknown> {
  return {
    filekey: params.filekey,
    media_type: params.mediaType,
    to_user_id: params.toUserId,
    rawsize: params.rawsize,
    rawfilemd5: params.rawfilemd5,
    filesize: params.filesize,
    no_need_thumb: true,
    aeskey: params.aeskeyHex,
  };
}

/** CDN upload URL from upload_param (POST — PUT 404s on the CDN, per the port). */
export function buildCdnUploadUrl(params: {
  cdnBaseUrl: string;
  uploadParam: string;
  filekey: string;
}): string {
  return `${params.cdnBaseUrl.replace(/\/+$/, "")}/upload?encrypted_query_param=${encodeURIComponent(params.uploadParam)}&filekey=${encodeURIComponent(params.filekey)}`;
}

/** CDN download URL from an encrypted query param. */
export function buildCdnDownloadUrl(params: {
  cdnBaseUrl: string;
  encryptedQueryParam: string;
}): string {
  return `${params.cdnBaseUrl.replace(/\/+$/, "")}/download?encrypted_query_param=${encodeURIComponent(params.encryptedQueryParam)}`;
}

/** Generate a random filekey / aes key pair for an outbound upload. */
export function generateMediaKeys(): { filekey: string; aesKey: Buffer } {
  return { filekey: randomBytes(16).toString("hex"), aesKey: randomBytes(16) };
}

/**
 * The API expects aes_key as base64(hex_string), not base64(raw bytes) —
 * otherwise images render as grey boxes (documented quirk in the Python port).
 */
export function aesKeyForApi(aesKey: Buffer): string {
  return Buffer.from(aesKey.toString("hex"), "ascii").toString("base64");
}
