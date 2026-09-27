import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";

/** Build a mock IncomingMessage with method + URL and (optionally) a body. */
export function makeReq(method: string, url: string, body?: string): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage & { destroyed: boolean };
  req.method = method;
  req.url = url;
  req.headers = {};
  req.socket = { remoteAddress: "127.0.0.1" } as unknown as IncomingMessage["socket"];
  req.destroyed = false;
  req.destroy = ((_: Error | undefined) => {
    if (req.destroyed) {
      return req;
    }
    req.destroyed = true;
    return req;
  }) as IncomingMessage["destroy"];
  if (body !== undefined) {
    process.nextTick(() => {
      if (req.destroyed) {
        return;
      }
      req.emit("data", Buffer.from(body));
      req.emit("end");
    });
  }
  return req;
}

export type MockRes = ServerResponse & {
  _status: number;
  _body: string;
  _headers: Record<string, unknown>;
};

export function makeRes(): MockRes {
  const res = {
    _status: 0,
    _body: "",
    _headers: {},
    writeHead(statusCode: number, headers?: Record<string, unknown>) {
      res._status = statusCode;
      res._headers = headers ?? {};
    },
    end(body?: string) {
      res._body = body ?? "";
    },
  } as unknown as MockRes;
  return res;
}

/** Wait for the next macrotask so queued deliver() calls run. */
export function flushAsync(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
