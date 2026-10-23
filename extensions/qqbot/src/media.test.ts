import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QqbotApiError } from "./client.js";
import { QqbotClient } from "./client.js";
import {
  QqbotUploadDailyLimitError,
  computeBufferHashes,
  qqbotMediaTypeFor,
  uploadQqbotLocalFile,
  uploadQqbotMediaUrl,
} from "./media.js";
import { QqbotTokenManager, type QqbotFetchLike } from "./token.js";

type RecordedRequest = {
  kind: "api" | "put";
  url: string;
  method?: string;
  body?: string;
};

function makeFetchMock(routes: {
  api?: (url: string, body: unknown) => { status?: number; body: unknown };
  put?: (url: string) => { status?: number; body?: string };
}): { fetchImpl: QqbotFetchLike; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  const fetchImpl: QqbotFetchLike = async (url, init) => {
    const method = init?.method ?? "GET";
    if (method === "PUT") {
      requests.push({ kind: "put", url, method });
      const response = routes.put?.(url) ?? { status: 200 };
      const status = response.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => ({}),
        text: async () => response.body ?? "",
      };
    }
    const parsed = init?.body ? (JSON.parse(init.body) as unknown) : {};
    requests.push({ kind: "api", url, method, body: init?.body });
    const response = routes.api?.(url, parsed) ?? { status: 200, body: {} };
    const status = response.status ?? 200;
    const raw = typeof response.body === "string" ? response.body : JSON.stringify(response.body);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => JSON.parse(raw) as unknown,
      text: async () => raw,
    };
  };
  return { fetchImpl, requests };
}

function makeClient(fetchImpl: QqbotFetchLike): QqbotClient {
  const tokenManager = new QqbotTokenManager({
    appId: "app-1",
    clientSecret: "secret-1",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "T", expires_in: 7200 }),
      text: async () => JSON.stringify({ access_token: "T", expires_in: 7200 }),
    }),
  });
  return new QqbotClient({ tokenManager, apiBase: "https://api.sgroup.qq.com", fetchImpl });
}

describe("computeBufferHashes", () => {
  it("matches node crypto digests and reuses md5 for md5_10m on small buffers", () => {
    const bytes = Buffer.from("paleoclaw qq upload hash test");
    const hashes = computeBufferHashes(bytes);
    expect(hashes.md5).toBe(createHash("md5").update(bytes).digest("hex"));
    expect(hashes.sha1).toBe(createHash("sha1").update(bytes).digest("hex"));
    expect(hashes.md5_10m).toBe(hashes.md5);
  });

  it("hashes only the first 10_002_432 bytes for md5_10m on large buffers", () => {
    const bytes = Buffer.alloc(10_002_432 + 100, 7);
    const hashes = computeBufferHashes(bytes);
    expect(hashes.md5_10m).toBe(
      createHash("md5").update(bytes.subarray(0, 10_002_432)).digest("hex"),
    );
  });
});

describe("qqbotMediaTypeFor", () => {
  it("maps media kinds to QQ file types", () => {
    expect(qqbotMediaTypeFor("image")).toBe(1);
    expect(qqbotMediaTypeFor("video")).toBe(2);
    expect(qqbotMediaTypeFor("voice")).toBe(3);
    expect(qqbotMediaTypeFor("file")).toBe(4);
  });
});

describe("uploadQqbotMediaUrl", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("global fetch should not be used (client fetch is injected)");
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs file_type + url + srv_send_msg=false to the files endpoint", async () => {
    const { fetchImpl, requests } = makeFetchMock({
      api: (url) =>
        url.endsWith("/v2/users/OPEN-1/files")
          ? { body: { file_info: "FI-1", file_uuid: "uuid" } }
          : { body: {} },
    });
    const result = await uploadQqbotMediaUrl({
      client: makeClient(fetchImpl),
      chatKind: "c2c",
      targetId: "OPEN-1",
      mediaKind: "image",
      url: "https://example.com/pic.png",
    });

    expect(result.fileInfo).toBe("FI-1");
    const filesCall = requests.find((r) => r.url.endsWith("/files"));
    expect(filesCall).toBeDefined();
    expect(JSON.parse(filesCall?.body ?? "{}")).toEqual({
      file_type: 1,
      url: "https://example.com/pic.png",
      srv_send_msg: false,
    });
  });

  it("includes file_name for file uploads", async () => {
    const { fetchImpl, requests } = makeFetchMock({
      api: () => ({ body: { file_info: "FI-2" } }),
    });
    await uploadQqbotMediaUrl({
      client: makeClient(fetchImpl),
      chatKind: "group",
      targetId: "GROUP-1",
      mediaKind: "file",
      url: "https://example.com/report.pdf",
      fileName: "report.pdf",
    });
    const filesCall = requests.find((r) => r.kind === "api" && r.url.endsWith("/files"));
    expect(JSON.parse(filesCall?.body ?? "{}").file_name).toBe("report.pdf");
  });
});

describe("uploadQqbotLocalFile (chunked)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubGlobalFetch(fetchImpl: QqbotFetchLike): void {
    // The COS part PUT goes through the global fetch — route it to the mock too.
    vi.stubGlobal("fetch", fetchImpl as unknown as typeof fetch);
  }

  it("runs prepare → PUT parts → part_finish → files and returns file_info", async () => {
    const bytes = Buffer.alloc(2500, 1);
    const { fetchImpl, requests } = makeFetchMock({
      api: (url, body) => {
        if (url.endsWith("/upload_prepare")) {
          return {
            body: {
              upload_id: "UP-1",
              block_size: 1000,
              parts: [
                { part_index: 1, presigned_url: "https://cos.qq.com/part1" },
                { part_index: 2, presigned_url: "https://cos.qq.com/part2" },
                { part_index: 3, presigned_url: "https://cos.qq.com/part3" },
              ],
            },
          };
        }
        if (url.endsWith("/upload_part_finish")) {
          return { body: {} };
        }
        if (url.endsWith("/files")) {
          expect((body as Record<string, unknown>).upload_id).toBe("UP-1");
          return { body: { file_info: "FI-CHUNKED" } };
        }
        return { body: {} };
      },
    });

    stubGlobalFetch(fetchImpl);
    const result = await uploadQqbotLocalFile({
      client: makeClient(fetchImpl),
      chatKind: "c2c",
      targetId: "OPEN-1",
      mediaKind: "file",
      filePath: "report.pdf",
      fileName: "report.pdf",
      bytes,
    });

    expect(result.fileInfo).toBe("FI-CHUNKED");
    const prepareCall = requests.find((r) => r.url.endsWith("/upload_prepare"));
    const prepareBody = JSON.parse(prepareCall?.body ?? "{}");
    expect(prepareBody.file_size).toBe(2500);
    expect(prepareBody.md5).toBe(createHash("md5").update(bytes).digest("hex"));
    expect(prepareBody.md5_10m).toBe(prepareBody.md5);

    expect(requests.filter((r) => r.kind === "put")).toHaveLength(3);
    expect(requests.filter((r) => r.url.endsWith("/upload_part_finish"))).toHaveLength(3);

    const finish1 = requests.filter((r) => r.url.endsWith("/upload_part_finish"))[0];
    const finishBody = JSON.parse(finish1?.body ?? "{}");
    expect(finishBody).toMatchObject({ upload_id: "UP-1", part_index: 1, block_size: 1000 });
    expect(finishBody.md5).toBe(createHash("md5").update(bytes.subarray(0, 1000)).digest("hex"));
  });

  it("retries transient part_finish biz_code 40093001", async () => {
    const bytes = Buffer.alloc(10, 2);
    let finishAttempts = 0;
    const { fetchImpl, requests } = makeFetchMock({
      api: (url) => {
        if (url.endsWith("/upload_prepare")) {
          return {
            body: {
              upload_id: "UP-2",
              block_size: 100,
              parts: [{ part_index: 1, presigned_url: "https://cos.qq.com/p1" }],
            },
          };
        }
        if (url.endsWith("/upload_part_finish")) {
          finishAttempts += 1;
          if (finishAttempts < 3) {
            return { status: 400, body: { biz_code: 40093001, message: "processing" } };
          }
          return { body: {} };
        }
        if (url.endsWith("/files")) {
          return { body: { file_info: "FI-RETRY" } };
        }
        return { body: {} };
      },
    });

    stubGlobalFetch(fetchImpl);
    const result = await uploadQqbotLocalFile({
      client: makeClient(fetchImpl),
      chatKind: "group",
      targetId: "GROUP-1",
      mediaKind: "image",
      filePath: "x.png",
      bytes,
    });
    expect(result.fileInfo).toBe("FI-RETRY");
    expect(finishAttempts).toBe(3);
    expect(requests.filter((r) => r.url.endsWith("/upload_part_finish"))).toHaveLength(3);
  });

  it("throws QqbotUploadDailyLimitError on biz_code 40093002 from prepare", async () => {
    const { fetchImpl } = makeFetchMock({
      api: () => ({ status: 400, body: { biz_code: 40093002, message: "daily limit" } }),
    });
    await expect(
      uploadQqbotLocalFile({
        client: makeClient(fetchImpl),
        chatKind: "c2c",
        targetId: "OPEN-1",
        mediaKind: "image",
        filePath: "x.png",
        bytes: Buffer.alloc(10, 1),
      }),
    ).rejects.toBeInstanceOf(QqbotUploadDailyLimitError);
  });

  it("rejects guild targets (v2 upload API is c2c/group only)", async () => {
    const { fetchImpl } = makeFetchMock({});
    stubGlobalFetch(fetchImpl);
    await expect(
      uploadQqbotLocalFile({
        client: makeClient(fetchImpl),
        chatKind: "guild",
        targetId: "CH-1",
        mediaKind: "image",
        filePath: "x.png",
        bytes: Buffer.alloc(10, 1),
      }),
    ).rejects.toThrow(/guild/i);
  });

  it("surfaces non-retryable API errors as QqbotApiError", async () => {
    const { fetchImpl } = makeFetchMock({
      api: (url) =>
        url.endsWith("/upload_part_finish")
          ? { status: 400, body: { biz_code: 50000001, message: "bad md5" } }
          : url.endsWith("/upload_prepare")
            ? {
                body: {
                  upload_id: "UP-3",
                  block_size: 100,
                  parts: [{ part_index: 1, presigned_url: "https://cos.qq.com/p1" }],
                },
              }
            : { body: {} },
    });
    stubGlobalFetch(fetchImpl);
    await expect(
      uploadQqbotLocalFile({
        client: makeClient(fetchImpl),
        chatKind: "c2c",
        targetId: "OPEN-1",
        mediaKind: "image",
        filePath: "x.png",
        bytes: Buffer.alloc(10, 1),
      }),
    ).rejects.toBeInstanceOf(QqbotApiError);
  });
});
