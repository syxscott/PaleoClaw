/**
 * QQ media upload (reference chunked_upload.py + adapter.py `_upload_media`).
 *
 * Two paths, both ending in a `file_info` used by a msg_type 7 media message:
 * 1. URL source → single POST .../files {file_type, url, srv_send_msg:false}
 *    (QQ fetches the URL itself).
 * 2. Local file → chunked upload: POST .../upload_prepare (hashes, part plan) →
 *    PUT each part to its pre-signed COS URL → POST .../upload_part_finish per
 *    part → POST .../files {upload_id} → file_info.
 *
 * biz_code 40093001 (part_finish) is transient and retried; 40093002 is the
 * daily quota and surfaced as QqbotUploadDailyLimitError.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { QqbotApiError, QqbotClient } from "./client.js";
import {
  QQ_MEDIA_TYPE_FILE,
  QQ_MEDIA_TYPE_IMAGE,
  QQ_MEDIA_TYPE_VIDEO,
  QQ_MEDIA_TYPE_VOICE,
  QQ_UPLOAD_BIZ_CODE_DAILY_LIMIT,
  QQ_UPLOAD_BIZ_CODE_PART_RETRYABLE,
  QQ_UPLOAD_MD5_10M_SIZE,
  QQBOT_FILE_UPLOAD_TIMEOUT_MS,
} from "./constants.js";
import { qqbotFilesPath } from "./outbound.js";
import type { QqbotChatKind } from "./types.js";

export type QqbotMediaKind = "image" | "video" | "voice" | "file";

export function qqbotMediaTypeFor(kind: QqbotMediaKind): number {
  switch (kind) {
    case "image":
      return QQ_MEDIA_TYPE_IMAGE;
    case "video":
      return QQ_MEDIA_TYPE_VIDEO;
    case "voice":
      return QQ_MEDIA_TYPE_VOICE;
    default:
      return QQ_MEDIA_TYPE_FILE;
  }
}

export class QqbotUploadDailyLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QqbotUploadDailyLimitError";
  }
}

export type QqbotUploadResult = {
  fileInfo: string;
  raw: Record<string, unknown>;
};

/** Upload media from an HTTP(S) URL (QQ fetches it server-side). */
export async function uploadQqbotMediaUrl(params: {
  client: QqbotClient;
  chatKind: QqbotChatKind;
  targetId: string;
  mediaKind: QqbotMediaKind;
  url: string;
  fileName?: string;
}): Promise<QqbotUploadResult> {
  const body: Record<string, unknown> = {
    file_type: qqbotMediaTypeFor(params.mediaKind),
    url: params.url,
    srv_send_msg: false,
  };
  if (params.mediaKind === "file" && params.fileName) {
    body.file_name = params.fileName;
  }
  const raw = await params.client.request(
    "POST",
    qqbotFilesPath(params.chatKind, params.targetId),
    body,
    QQBOT_FILE_UPLOAD_TIMEOUT_MS,
  );
  return extractFileInfo(raw);
}

/**
 * Chunked-upload a local file. `data` is read via readFile; tests can pass
 * `bytes` directly to skip the filesystem.
 */
export async function uploadQqbotLocalFile(params: {
  client: QqbotClient;
  chatKind: QqbotChatKind;
  targetId: string;
  mediaKind: QqbotMediaKind;
  filePath: string;
  fileName?: string;
  bytes?: Buffer;
}): Promise<QqbotUploadResult> {
  if (params.chatKind === "guild") {
    throw new Error("Guild media send is not supported by the QQ v2 upload API");
  }
  const bytes = params.bytes ?? (await readFile(params.filePath));
  const fileName = params.fileName ?? params.filePath.split(/[\\/]/).pop() ?? "qq_attachment";
  const hashes = computeBufferHashes(bytes);
  const path = (endpoint: string) =>
    qqbotFilesPath(params.chatKind, params.targetId).replace(/\/files$/, `/${endpoint}`);

  let prepareRaw: Record<string, unknown>;
  try {
    prepareRaw = await params.client.request(
      "POST",
      path("upload_prepare"),
      {
        file_type: qqbotMediaTypeFor(params.mediaKind),
        file_name: fileName,
        file_size: bytes.length,
        md5: hashes.md5,
        sha1: hashes.sha1,
        md5_10m: hashes.md5_10m,
      },
      QQBOT_FILE_UPLOAD_TIMEOUT_MS,
    );
  } catch (err) {
    if (err instanceof QqbotApiError && err.bizCode === QQ_UPLOAD_BIZ_CODE_DAILY_LIMIT) {
      throw new QqbotUploadDailyLimitError(
        `QQ daily upload limit exceeded for ${JSON.stringify(fileName)}`,
      );
    }
    throw err;
  }
  if (isBizCode(prepareRaw, QQ_UPLOAD_BIZ_CODE_DAILY_LIMIT)) {
    throw new QqbotUploadDailyLimitError(
      `QQ daily upload limit exceeded for ${JSON.stringify(fileName)}`,
    );
  }
  const prepare = parsePrepareResponse(prepareRaw);

  for (const part of prepare.parts) {
    const offset = (part.partIndex - 1) * prepare.blockSize;
    const length = Math.min(
      part.blockSize > 0 ? part.blockSize : prepare.blockSize,
      bytes.length - offset,
    );
    const chunk = bytes.subarray(offset, offset + length);
    await putToPresignedUrl(part.presignedUrl, chunk);
    await finishPartWithRetry(params.client, path("upload_part_finish"), {
      uploadId: prepare.uploadId,
      partIndex: part.partIndex,
      blockSize: length,
      md5: createHash("md5").update(chunk).digest("hex"),
    });
  }

  const completeRaw = await params.client.request(
    "POST",
    path("files"),
    { upload_id: prepare.uploadId },
    QQBOT_FILE_UPLOAD_TIMEOUT_MS,
  );
  return extractFileInfo(completeRaw);
}

type PreparedPart = { partIndex: number; presignedUrl: string; blockSize: number };

function parsePrepareResponse(raw: Record<string, unknown>): {
  uploadId: string;
  blockSize: number;
  parts: PreparedPart[];
} {
  const src =
    raw.data !== null && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : raw;
  const uploadId = typeof src.upload_id === "string" ? src.upload_id : "";
  if (!uploadId) {
    throw new Error(
      `upload_prepare response missing upload_id: ${JSON.stringify(raw).slice(0, 200)}`,
    );
  }
  const blockSize = typeof src.block_size === "number" ? src.block_size : 0;
  const rawParts = Array.isArray(src.parts)
    ? src.parts
    : Array.isArray(src.part_list)
      ? src.part_list
      : [];
  const parts: PreparedPart[] = [];
  for (const entry of rawParts) {
    if (entry === null || typeof entry !== "object") {
      continue;
    }
    const part = entry as Record<string, unknown>;
    const presignedUrl =
      typeof part.presigned_url === "string"
        ? part.presigned_url
        : typeof part.url === "string"
          ? part.url
          : "";
    if (!presignedUrl) {
      continue;
    }
    parts.push({
      partIndex: asNumber(part.part_index ?? part.index) || 0,
      presignedUrl,
      blockSize: asNumber(part.block_size) || 0,
    });
  }
  if (parts.length === 0) {
    throw new Error(`upload_prepare response missing parts: ${JSON.stringify(raw).slice(0, 200)}`);
  }
  return { uploadId, blockSize, parts };
}

async function putToPresignedUrl(url: string, chunk: Buffer): Promise<void> {
  // undici/fetch sets Content-Length from the body automatically.
  const response = await fetch(url, {
    method: "PUT",
    body: new Uint8Array(chunk),
  });
  if (!response.ok) {
    throw new Error(
      `COS PUT returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }
}

async function finishPartWithRetry(
  client: QqbotClient,
  path: string,
  params: { uploadId: string; partIndex: number; blockSize: number; md5: string },
  attempt = { tries: 0 },
): Promise<void> {
  try {
    await client.request(
      "POST",
      path,
      {
        upload_id: params.uploadId,
        part_index: params.partIndex,
        block_size: params.blockSize,
        md5: params.md5,
      },
      QQBOT_FILE_UPLOAD_TIMEOUT_MS,
    );
  } catch (err) {
    if (
      err instanceof QqbotApiError &&
      err.bizCode === QQ_UPLOAD_BIZ_CODE_PART_RETRYABLE &&
      attempt.tries < 3
    ) {
      attempt.tries += 1;
      await finishPartWithRetry(client, path, params, attempt);
      return;
    }
    throw err;
  }
}

function extractFileInfo(raw: Record<string, unknown>): QqbotUploadResult {
  const src =
    raw.data !== null && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : raw;
  const fileInfo = typeof src.file_info === "string" ? src.file_info : "";
  if (!fileInfo) {
    throw new Error(`Upload returned no file_info: ${JSON.stringify(raw).slice(0, 200)}`);
  }
  return { fileInfo, raw };
}

function isBizCode(raw: Record<string, unknown>, code: number): boolean {
  if (raw.biz_code === code) {
    return true;
  }
  return (
    raw.data !== null &&
    typeof raw.data === "object" &&
    (raw.data as Record<string, unknown>).biz_code === code
  );
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

/** md5 / sha1 / md5_10m (first QQ_UPLOAD_MD5_10M_SIZE bytes) for upload_prepare. */
export function computeBufferHashes(bytes: Buffer): { md5: string; sha1: string; md5_10m: string } {
  const md5 = createHash("md5");
  const sha1 = createHash("sha1");
  const md510m = createHash("md5");
  const need10m = bytes.length > QQ_UPLOAD_MD5_10M_SIZE;
  md5.update(bytes);
  sha1.update(bytes);
  md510m.update(need10m ? bytes.subarray(0, QQ_UPLOAD_MD5_10M_SIZE) : bytes);
  return { md5: md5.digest("hex"), sha1: sha1.digest("hex"), md5_10m: md510m.digest("hex") };
}
