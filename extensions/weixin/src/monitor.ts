/**
 * Weixin (微信) iLink bot monitor — connection/bridge lifecycle structure.
 *
 * Ported loop semantics from hermes-agent `weixin.py::WeixinAdapter`:
 *   - long-poll `getupdates` with the persisted `get_updates_buf` cursor
 *   - suggested `longpolling_timeout_ms` honored
 *   - session-expired (-14 / -2 "unknown error") → pause 10 minutes
 *   - failure streak backoff (3 failures → 30s), then keep retrying
 *   - per-peer `context_token` captured into the store for outbound echo
 *   - DM/group policy gate + dedup before dispatch
 *
 * Media download/upload and typing indicators are stubbed behind interfaces
 * (see README notes in channel.ts agentPrompt) — the text path is complete.
 */

import { ContextTokenStore } from "./context-tokens.js";
import { getUpdates, isSessionExpired } from "./ilink.js";
import type { FetchLike } from "./ilink.js";
import { normalizeWeixinMessage } from "./normalize.js";
import type { ResolvedWeixinAccount } from "./types.js";
import type { WeixinIlinkMessage } from "./types.js";

const MAX_CONSECUTIVE_FAILURES = 3;
const RETRY_DELAY_MS = 2_000;
const BACKOFF_DELAY_MS = 30_000;
const SESSION_EXPIRED_PAUSE_MS = 600_000;
const MESSAGE_DEDUP_TTL_MS = 300_000;

export type WeixinDeliver = (
  message: NonNullable<ReturnType<typeof normalizeWeixinMessage>>,
) => Promise<void>;

export type WeixinMonitorOptions = {
  account: ResolvedWeixinAccount;
  contextTokens: ContextTokenStore;
  deliver: WeixinDeliver;
  log?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
  fetchImpl?: FetchLike;
  /** Initial sync cursor (callers may persist it externally). */
  initialSyncBuf?: string;
  /** Called whenever the cursor advances, for external persistence. */
  onSyncBuf?: (syncBuf: string) => void;
};

/** Content-fingerprint dedup (upstream resends identical text under new ids). */
export function contentFingerprint(senderId: string, text: string): string {
  return `content:${senderId}:${simpleHash(text)}`;
}

function simpleHash(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

export class WeixinMonitor {
  private readonly options: WeixinMonitorOptions;
  private running = false;
  private syncBuf: string;
  private seenMessageIds = new Map<string, number>();
  private seenContent = new Map<string, number>();
  private pollPromise: Promise<void> | null = null;

  constructor(options: WeixinMonitorOptions) {
    this.options = options;
    this.syncBuf = options.initialSyncBuf ?? "";
  }

  get contextTokenStore(): ContextTokenStore {
    return this.options.contextTokens;
  }

  start(): Promise<void> {
    if (this.running) {
      return this.pollPromise ?? Promise.resolve();
    }
    this.running = true;
    this.pollPromise = this.pollLoop();
    return this.pollPromise;
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pollPromise) {
      await this.pollPromise;
      this.pollPromise = null;
    }
  }

  private async pollLoop(): Promise<void> {
    const { account, fetchImpl } = this.options;
    let consecutiveFailures = 0;
    let timeoutMs = 35_000;

    while (this.running) {
      try {
        const response = await getUpdates({
          baseUrl: account.baseUrl,
          token: account.token,
          syncBuf: this.syncBuf,
          timeoutMs,
          fetchImpl,
        });
        const suggestedTimeout = response.longpolling_timeout_ms;
        if (typeof suggestedTimeout === "number" && suggestedTimeout > 0) {
          timeoutMs = suggestedTimeout;
        }
        const ret = response.ret ?? 0;
        const errcode = response.errcode ?? 0;
        if ((ret !== 0 || errcode !== 0) && !(ret === 0 && errcode === 0)) {
          if (isSessionExpired(response as Record<string, unknown>, ret, errcode)) {
            this.options.log?.warn?.("weixin: session expired; pausing for 10 minutes");
            await sleep(SESSION_EXPIRED_PAUSE_MS);
            consecutiveFailures = 0;
            continue;
          }
          consecutiveFailures += 1;
          this.options.log?.warn?.(
            `weixin: getUpdates failed ret=${ret} errcode=${errcode} (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`,
          );
          await sleep(this.backoffDelay(consecutiveFailures));
          continue;
        }
        consecutiveFailures = 0;
        if (response.get_updates_buf) {
          this.syncBuf = response.get_updates_buf;
          this.options.onSyncBuf?.(this.syncBuf);
        }
        for (const message of response.msgs ?? []) {
          this.processMessageSafe(message);
        }
      } catch (error) {
        if (!this.running) {
          return;
        }
        consecutiveFailures += 1;
        this.options.log?.error?.(
          `weixin: poll error (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${String(error)}`,
        );
        await sleep(this.backoffDelay(consecutiveFailures));
      }
    }
  }

  private backoffDelay(consecutiveFailures: number): number {
    return consecutiveFailures >= MAX_CONSECUTIVE_FAILURES ? BACKOFF_DELAY_MS : RETRY_DELAY_MS;
  }

  /** Policy gate + dedup + dispatch (port of `_process_message` intake). */
  async processMessageSafe(message: WeixinIlinkMessage): Promise<void> {
    try {
      await this.processMessage(message);
    } catch (error) {
      this.options.log?.error?.(`weixin: inbound error: ${String(error)}`);
    }
  }

  private async processMessage(message: WeixinIlinkMessage): Promise<void> {
    const { account } = this.options;
    const senderId = String(message.from_user_id ?? "").trim();
    const messageId = String(message.message_id ?? "").trim();
    if (!senderId || senderId === account.botId) {
      return;
    }
    if (messageId && this.isDuplicate(this.seenMessageIds, messageId)) {
      return;
    }

    const normalized = normalizeWeixinMessage(message, account.botId);
    if (!normalized) {
      return;
    }
    const fingerprint = contentFingerprint(senderId, normalized.text);
    if (normalized.text && this.isDuplicate(this.seenContent, fingerprint)) {
      this.options.log?.info?.(`weixin: content-dedup skip from ${senderId}`);
      return;
    }

    if (normalized.chatType === "group") {
      if (
        account.groupPolicy === "disabled" ||
        (account.groupPolicy === "allowlist" && !account.groupAllowFrom.includes(normalized.chatId))
      ) {
        return;
      }
    } else if (!this.isDmIntakeAllowed(senderId)) {
      return;
    }

    // Capture the per-peer context_token — required for every outbound reply.
    const contextToken = String(message.context_token ?? "").trim();
    if (contextToken) {
      await this.options.contextTokens.set(account.accountId, normalized.chatId, contextToken);
    }

    await this.options.deliver(normalized);
  }

  private isDmIntakeAllowed(senderId: string): boolean {
    const { account } = this.options;
    if (account.dmPolicy === "pairing") {
      return true; // pairing gate runs later in the gateway
    }
    if (account.dmPolicy === "allowlist") {
      return account.allowFrom.includes(senderId);
    }
    return account.dmPolicy === "open";
  }

  private isDuplicate(store: Map<string, number>, key: string): boolean {
    const now = Date.now();
    this.evict(store, now);
    if (store.has(key)) {
      return true;
    }
    store.set(key, now);
    return false;
  }

  private evict(store: Map<string, number>, now: number): void {
    for (const [key, ts] of store) {
      if (now - ts >= MESSAGE_DEDUP_TTL_MS) {
        store.delete(key);
      } else {
        break;
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
