/**
 * WeCom callback HTTP handler.
 *
 * - GET  ?msg_signature&timestamp&nonce&echostr  → URL verification handshake:
 *   decrypt echostr and answer with the plaintext.
 * - POST encrypted XML body                      → verify + decrypt, normalize,
 *   acknowledge "success" immediately (WeCom requires a fast 2xx), then hand
 *   the message to the gateway asynchronously. Replies are sent later via the
 *   proactive message/send API (see qyapi.ts).
 *
 * Ported from hermes-agent `wecom_callback.py::_handle_verify` /
 * `_handle_callback`.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "paleoclaw/plugin-sdk/wecom";
import { WxBizMsgCrypt, WeComCryptoError } from "./crypto.js";
import { MessageDedup } from "./dedup.js";
import { parseWecomMessage } from "./normalize.js";
import type { ResolvedWecomAccount, WecomInboundMessage } from "./types.js";
import { parseXmlEnvelope } from "./xml.js";

const MAX_BODY_BYTES = 1_048_576;

export type WecomCallbackDeps = {
  account: ResolvedWecomAccount;
  /** Dispatch a normalized inbound message to the agent (async fire-and-forget). */
  deliver: (message: WecomInboundMessage) => void | Promise<void>;
  log?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
};

function respondText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "Content-Type": "text/plain" });
  res.end(body);
}

function queryParam(url: URL, name: string): string {
  return url.searchParams.get(name) ?? "";
}

/** Build the crypt helper for the account (throws on incomplete config). */
export function createCryptForAccount(account: ResolvedWecomAccount): WxBizMsgCrypt {
  return new WxBizMsgCrypt({
    token: account.token,
    encodingAesKey: account.encodingAesKey,
    receiveId: account.corpId,
  });
}

export function createWecomCallbackHandler(deps: WecomCallbackDeps) {
  const { account, deliver, log } = deps;
  const dedup = new MessageDedup();

  /** Exposed for tests / diagnostics. Returns false when deduplicated. */
  const handleMessage = (message: WecomInboundMessage): boolean => {
    const dedupKey = message.msgId ?? `${message.fromUserId}:${message.createTime}`;
    if (dedup.isDuplicate(dedupKey)) {
      log?.warn?.(`wecom: duplicate callback ${dedupKey} ignored`);
      return false;
    }
    Promise.resolve()
      .then(() => deliver(message))
      .catch((error: unknown) => {
        log?.error?.(`wecom: deliver failed: ${String(error)}`);
      });
    return true;
  };

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    let url: URL;
    try {
      url = new URL(req.url ?? "/", "http://localhost");
    } catch {
      respondText(res, 400, "invalid url");
      return;
    }

    let crypt: WxBizMsgCrypt;
    try {
      crypt = createCryptForAccount(account);
    } catch (error) {
      log?.error?.(`wecom: crypto config invalid: ${String(error)}`);
      respondText(res, 500, "callback misconfigured");
      return;
    }

    const msgSignature = queryParam(url, "msg_signature");
    const timestamp = queryParam(url, "timestamp");
    const nonce = queryParam(url, "nonce");

    if (req.method === "GET") {
      // URL verification handshake: decrypt echostr, echo the plaintext.
      const echostr = queryParam(url, "echostr");
      if (!echostr) {
        respondText(res, 400, "missing echostr");
        return;
      }
      try {
        const plain = crypt.verifyUrl(msgSignature, timestamp, nonce, echostr);
        respondText(res, 200, plain);
      } catch (error) {
        log?.warn?.(`wecom: echo verification failed: ${String(error)}`);
        respondText(res, 403, "signature verification failed");
      }
      return;
    }

    if (req.method !== "POST") {
      respondText(res, 405, "method not allowed");
      return;
    }

    // POST: encrypted message callback.
    let body: string;
    try {
      body = await readRequestBodyWithLimit(req, {
        maxBytes: MAX_BODY_BYTES,
        timeoutMs: 30_000,
      });
    } catch (error) {
      if (isRequestBodyLimitError(error)) {
        respondText(res, error.statusCode, requestBodyErrorToText(error.code));
      } else {
        respondText(res, 400, "invalid request body");
      }
      return;
    }

    try {
      const envelope = parseXmlEnvelope(body);
      const encrypt = envelope.Encrypt ?? "";
      if (!encrypt) {
        respondText(res, 400, "missing Encrypt field");
        return;
      }
      const decryptedXml = crypt.decrypt(msgSignature, timestamp, nonce, encrypt).toString("utf8");
      const message = parseWecomMessage(decryptedXml);
      // Acknowledge immediately — the reply arrives later via message/send.
      respondText(res, 200, "success");
      if (message) {
        handleMessage(message);
      }
    } catch (error) {
      if (error instanceof WeComCryptoError) {
        log?.warn?.(`wecom: callback rejected: ${String(error)}`);
        respondText(res, 400, "invalid callback payload");
        return;
      }
      log?.error?.(`wecom: error handling callback: ${String(error)}`);
      respondText(res, 400, "invalid callback payload");
    }
  };

  return { handler, handleMessage, dedup };
}
