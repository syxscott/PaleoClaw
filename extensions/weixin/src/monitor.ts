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

import { randomUUID } from "node:crypto";
import {
  issuePairingChallenge,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithLists,
} from "paleoclaw/plugin-sdk/weixin";
import type {
  ChannelId,
  DmGroupAccessDecision,
  DmGroupAccessReasonCode,
  LookupFn,
  SsrFPolicy,
} from "paleoclaw/plugin-sdk/weixin";
import { ContextTokenStore } from "./context-tokens.js";
import { getUpdates, isSessionExpired, sendMessage } from "./ilink.js";
import type { FetchLike } from "./ilink.js";
import { normalizeWeixinMessage } from "./normalize.js";
import type { ResolvedWeixinAccount } from "./types.js";
import type { WeixinIlinkMessage } from "./types.js";

const CHANNEL_ID = "weixin";

const MAX_CONSECUTIVE_FAILURES = 3;
const RETRY_DELAY_MS = 2_000;
const BACKOFF_DELAY_MS = 30_000;
const SESSION_EXPIRED_PAUSE_MS = 600_000;
const MESSAGE_DEDUP_TTL_MS = 300_000;

/** Access decision for one inbound message (mirrors the shared dm-policy shape). */
export type WeixinAccessDecision = {
  decision: DmGroupAccessDecision;
  reasonCode: DmGroupAccessReasonCode;
  reason: string;
  effectiveAllowFrom: string[];
  effectiveGroupAllowFrom: string[];
  /** Sender matched the effective allowlist (owner-level authorization). */
  senderAllowed: boolean;
};

export type WeixinDeliver = (
  message: NonNullable<ReturnType<typeof normalizeWeixinMessage>>,
  access: WeixinAccessDecision,
) => Promise<void>;

/** Pairing-store access for the `weixin` channel (see createScopedPairingAccess). */
export type WeixinPairingAccess = {
  readStoreForDmPolicy: (provider: ChannelId, accountId: string) => Promise<string[]>;
  upsertPairingRequest: (input: {
    id: string;
    meta?: Record<string, string | undefined>;
  }) => Promise<{ code: string; created: boolean }>;
};

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
  /** Injected DNS resolver for the SSRF guard (tests). */
  lookupFn?: LookupFn;
  /** SSRF policy override for the guarded fetch. */
  ssrfPolicy?: SsrFPolicy;
  /** Pairing store access — required for `dmPolicy: "pairing"`. */
  pairing?: WeixinPairingAccess;
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

/**
 * Wildcard-aware allowlist match.
 * `"*"` is the repo-wide wildcard entry written by the onboarding helpers
 * (`addWildcardAllowFrom`) and means "allow every sender".
 */
export function isWeixinSenderAllowed(senderId: string, allowFrom: string[]): boolean {
  const normalized = senderId.trim();
  if (!normalized) {
    return false;
  }
  const entries = allowFrom.map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0) {
    return false;
  }
  if (entries.includes("*")) {
    return true;
  }
  return entries.includes(normalized);
}

export class WeixinMonitor {
  private readonly options: WeixinMonitorOptions;
  private running = false;
  private syncBuf: string;
  private seenMessageIds = new Map<string, number>();
  private seenContent = new Map<string, number>();
  private pollPromise: Promise<void> | null = null;
  /** Resolves as soon as `stop()` is called — used to interrupt long sleeps. */
  private stopSignal: Promise<void> = Promise.resolve();
  private signalStop: () => void = () => {};
  /** Aborts the in-flight poll request so `stop()` returns promptly. */
  private pollAbort: AbortController | null = null;

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
    this.stopSignal = new Promise<void>((resolve) => {
      this.signalStop = resolve;
    });
    this.pollPromise = this.pollLoop();
    return this.pollPromise;
  }

  async stop(): Promise<void> {
    this.running = false;
    // Wake every pending sleep and abort the in-flight request.
    this.signalStop();
    this.pollAbort?.abort();
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
      const abort = new AbortController();
      this.pollAbort = abort;
      try {
        const response = await getUpdates({
          baseUrl: account.baseUrl,
          token: account.token,
          syncBuf: this.syncBuf,
          timeoutMs,
          fetchImpl,
          lookupFn: this.options.lookupFn,
          ssrfPolicy: this.options.ssrfPolicy,
          signal: abort.signal,
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
            await this.sleep(SESSION_EXPIRED_PAUSE_MS);
            consecutiveFailures = 0;
            continue;
          }
          consecutiveFailures += 1;
          this.options.log?.warn?.(
            `weixin: getUpdates failed ret=${ret} errcode=${errcode} (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`,
          );
          await this.sleep(this.backoffDelay(consecutiveFailures));
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
        await this.sleep(this.backoffDelay(consecutiveFailures));
      } finally {
        if (this.pollAbort === abort) {
          this.pollAbort = null;
        }
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

    // Capture the per-peer context_token — required for every outbound reply
    // (including the pairing challenge reply).
    const contextToken = String(message.context_token ?? "").trim();
    if (contextToken) {
      await this.options.contextTokens.set(account.accountId, normalized.chatId, contextToken);
    }

    const access = await this.resolveAccess(normalized);
    if (access.decision !== "allow") {
      if (access.decision === "pairing") {
        await this.sendPairingChallenge(normalized);
      } else {
        this.options.log?.info?.(
          `weixin: drop ${normalized.chatType} from ${normalized.senderId} (${access.reasonCode})`,
        );
      }
      return;
    }

    await this.options.deliver(normalized, access);
  }

  /**
   * Shared DM/group access decision (config allowlist + pairing store).
   * `dmPolicy: "open"` stays open; `pairing` asks for a pairing code instead
   * of dispatching; `allowlist` blocks unlisted senders.
   */
  private async resolveAccess(
    normalized: NonNullable<ReturnType<typeof normalizeWeixinMessage>>,
  ): Promise<WeixinAccessDecision> {
    const { account } = this.options;
    const isGroup = normalized.chatType === "group";
    // Group allowlists are keyed by chat id; DM allowlists by sender id.
    const matchId = isGroup ? normalized.chatId : normalized.senderId;
    const storeAllowFrom = isGroup
      ? []
      : await readStoreAllowFromForDmPolicy({
          provider: CHANNEL_ID,
          accountId: account.accountId,
          dmPolicy: account.dmPolicy,
          readStore: this.options.pairing?.readStoreForDmPolicy ?? (async () => []),
        });

    const access = resolveDmGroupAccessWithLists({
      isGroup,
      dmPolicy: account.dmPolicy,
      groupPolicy: account.groupPolicy,
      allowFrom: account.allowFrom,
      groupAllowFrom: account.groupAllowFrom,
      storeAllowFrom,
      // Weixin group access is explicit — no fallback to the DM allowlist.
      groupAllowFromFallbackToAllowFrom: false,
      isSenderAllowed: (entries) => isWeixinSenderAllowed(matchId, entries),
    });

    return {
      decision: access.decision,
      reasonCode: access.reasonCode,
      reason: access.reason,
      effectiveAllowFrom: access.effectiveAllowFrom,
      effectiveGroupAllowFrom: access.effectiveGroupAllowFrom,
      senderAllowed: isWeixinSenderAllowed(
        matchId,
        isGroup ? access.effectiveGroupAllowFrom : access.effectiveAllowFrom,
      ),
    };
  }

  /** Issue the shared pairing challenge instead of dispatching to the agent. */
  private async sendPairingChallenge(
    normalized: NonNullable<ReturnType<typeof normalizeWeixinMessage>>,
  ): Promise<void> {
    const { account } = this.options;
    const pairing = this.options.pairing;
    if (!pairing) {
      this.options.log?.error?.(
        "weixin: pairing access is not wired; dropping DM (dmPolicy=pairing)",
      );
      return;
    }
    await issuePairingChallenge({
      channel: CHANNEL_ID,
      senderId: normalized.senderId,
      senderIdLine: `Your WeChat id: ${normalized.senderId}`,
      upsertPairingRequest: pairing.upsertPairingRequest,
      sendPairingReply: async (text) => {
        await this.sendPairingReply(normalized.chatId, text);
      },
      onCreated: ({ code }) => {
        this.options.log?.info?.(
          `weixin: pairing request created for ${normalized.senderId} (code ${code})`,
        );
      },
      onReplyError: (err) => {
        this.options.log?.error?.(
          `weixin: pairing reply failed for ${normalized.senderId}: ${String(err)}`,
        );
      },
    });
  }

  private async sendPairingReply(to: string, text: string): Promise<void> {
    const { account, contextTokens } = this.options;
    const result = await sendMessage({
      baseUrl: account.baseUrl,
      token: account.token,
      to,
      text,
      contextToken: contextTokens.get(account.accountId, to) ?? null,
      clientId: `paleoclaw-weixin-pairing-${Date.now()}-${randomUUID().slice(0, 8)}`,
      fetchImpl: this.options.fetchImpl,
      lookupFn: this.options.lookupFn,
      ssrfPolicy: this.options.ssrfPolicy,
    });
    const ret = result.ret ?? 0;
    const errcode = result.errcode ?? 0;
    if (ret !== 0 || errcode !== 0) {
      this.options.log?.warn?.(`weixin: pairing reply send failed ret=${ret} errcode=${errcode}`);
    }
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

  /**
   * Sleep that resolves immediately when the monitor is stopped, so the
   * 10-minute session-expired pause and the 30s backoff never block shutdown.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.running) {
        resolve();
        return;
      }
      let settled = false;
      let timer: NodeJS.Timeout | undefined;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        if (timer) {
          clearTimeout(timer);
        }
        resolve();
      };
      timer = setTimeout(finish, ms);
      void this.stopSignal.then(finish);
    });
  }
}
