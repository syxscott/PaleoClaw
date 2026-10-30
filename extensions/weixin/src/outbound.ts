/**
 * Outbound send interface for the weixin iLink bridge (port of `WeixinAdapter.send`
 * text path): chunk via the markdown-aware splitter, then sendmessage each chunk
 * with the peer's latest `context_token` (session-expired fallback: retry once
 * tokenless, matching the ported `_send_text_chunk` behavior).
 */

import { randomUUID } from "node:crypto";
import type { LookupFn, SsrFPolicy } from "paleoclaw/plugin-sdk/weixin";
import { resolveWeixinAccount } from "./accounts.js";
import { ContextTokenStore } from "./context-tokens.js";
import { buildSendMessagePayload, sendMessage, type FetchLike } from "./ilink.js";
import { normalizeMarkdownBlocks, splitTextForDelivery, wrapCopyFriendlyLines } from "./text.js";

export type WeixinSendResult = { ok: true; messageIds: string[] } | { ok: false; error: string };

function makeClientId(): string {
  return `paleoclaw-weixin-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export function createWeixinOutbound(
  deps: {
    contextTokens?: ContextTokenStore;
  } = {},
) {
  const contextTokens = deps.contextTokens;

  const sendTextChunks = async (params: {
    baseUrl: string;
    token: string;
    to: string;
    text: string;
    maxMessageLength: number;
    contextToken?: string | null;
    fetchImpl?: FetchLike;
    lookupFn?: LookupFn;
    ssrfPolicy?: SsrFPolicy;
  }): Promise<WeixinSendResult> => {
    const formatted = wrapCopyFriendlyLines(normalizeMarkdownBlocks(params.text));
    const chunks = splitTextForDelivery(formatted, params.maxMessageLength);
    if (chunks.length === 0) {
      return { ok: false, error: "weixin send: nothing to send" };
    }
    const messageIds: string[] = [];
    let contextToken = params.contextToken ?? null;
    for (const chunk of chunks) {
      const clientId = makeClientId();
      try {
        const response = await sendMessage({
          baseUrl: params.baseUrl,
          token: params.token,
          to: params.to,
          text: chunk,
          contextToken,
          clientId,
          fetchImpl: params.fetchImpl,
          lookupFn: params.lookupFn,
          ssrfPolicy: params.ssrfPolicy,
        });
        const ret = response.ret;
        const errcode = response.errcode;
        // Session expired (ret/errcode -14, or -2 "unknown error"): retry once
        // without the context_token (degraded fallback, keeps cron pushes alive).
        const expired =
          ret === -14 ||
          errcode === -14 ||
          ((ret === -2 || errcode === -2) &&
            String(response.errmsg ?? "").toLowerCase() === "unknown error");
        if (expired && contextToken) {
          const retry = await sendMessage({
            baseUrl: params.baseUrl,
            token: params.token,
            to: params.to,
            text: chunk,
            contextToken: null,
            clientId: makeClientId(),
            fetchImpl: params.fetchImpl,
            lookupFn: params.lookupFn,
            ssrfPolicy: params.ssrfPolicy,
          });
          const retryRet = retry.ret ?? 0;
          const retryErr = retry.errcode ?? 0;
          if (retryRet !== 0 || retryErr !== 0) {
            return {
              ok: false,
              error: `iLink sendmessage error: ret=${retryRet} errcode=${retryErr}`,
            };
          }
          messageIds.push(clientId);
          continue;
        }
        if ((ret !== undefined && ret !== 0) || (errcode !== undefined && errcode !== 0)) {
          return {
            ok: false,
            error: `iLink sendmessage error: ret=${ret} errcode=${errcode} errmsg=${String(response.errmsg ?? "unknown")}`,
          };
        }
        messageIds.push(clientId);
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    }
    return { ok: true, messageIds };
  };

  return {
    /** Plugin-contract sendText: resolves account from cfg and sends via iLink. */
    sendText: async ({ to, text, accountId, cfg, fetchImpl, lookupFn, ssrfPolicy }: any) => {
      const account = resolveWeixinAccount(cfg ?? {}, accountId);
      if (!account.configured) {
        throw new Error("Weixin account is not configured (missing token/botId from QR login)");
      }
      const contextToken =
        contextTokens?.get(account.accountId, to) ??
        (await readContextTokenFromDisk(account.accountId, to));
      const result = await sendTextChunks({
        baseUrl: account.baseUrl,
        token: account.token,
        to,
        text,
        maxMessageLength: account.maxMessageLength,
        contextToken,
        fetchImpl,
        lookupFn,
        ssrfPolicy,
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      return { channel: "weixin", messageId: result.messageIds.at(-1) ?? "", chatId: to };
    },

    /** Lower-level chunked send for tests / direct use. */
    sendTextChunks,
    /** Payload builder re-export for tests. */
    buildSendMessagePayload,
  };
}

/** Best-effort read of a persisted context token when no store is wired. */
async function readContextTokenFromDisk(accountId: string, to: string): Promise<string | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const root = `${process.env.OPENCLAW_STATE_DIR ?? ".paleoclaw"}/weixin`;
    const data = JSON.parse(
      await readFile(`${root}/${accountId}.context-tokens.json`, "utf8"),
    ) as Record<string, string>;
    return data[to] ?? null;
  } catch {
    return null;
  }
}
