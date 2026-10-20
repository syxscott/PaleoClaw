/**
 * QQ monitor: runs the WebSocket gateway for one account and dispatches
 * normalized inbound events to the agent runtime (inbound pipeline mirrors
 * extensions/irc + extensions/synology-chat: ACL gate → dedupe → route →
 * envelope → buffered block dispatcher → QQ REST reply with passive msg_id).
 */

import {
  buildAgentMediaPayload,
  createLoggerBackedRuntime,
  createScopedPairingAccess,
  issuePairingChallenge,
  resolveDmGroupAccessWithLists,
  type PluginRuntime,
  type RuntimeEnv,
} from "paleoclaw/plugin-sdk/qqbot";
import { allowListMatches, readQqbotStoreAllowFrom, resolveQqbotAccount } from "./accounts.js";
import { QqbotGateway } from "./gateway.js";
import { normalizeQqbotEvent } from "./normalize.js";
import { getQqbotRuntime } from "./runtime.js";
import { getQqbotAccountContext, type QqbotAccountContext } from "./send.js";
import type { CoreConfig, QqbotInboundMessage, ResolvedQqbotAccount } from "./types.js";

const CHANNEL_ID = "qqbot" as const;
const DEDUP_WINDOW_MS = 300_000;
const DEDUP_MAX_SIZE = 1000;

export type QqbotMonitorOptions = {
  accountId?: string;
  config?: CoreConfig;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
  /** Test seam / custom sink: bypasses the agent dispatch pipeline. */
  onMessage?: (message: QqbotInboundMessage) => void | Promise<void>;
};

export class InboundDeduper {
  private seen = new Map<string, number>();

  /** True when *id* was already seen inside the dedup window. */
  isDuplicate(id: string, now: number = Date.now()): boolean {
    if (!id) {
      return true;
    }
    if (this.seen.size > DEDUP_MAX_SIZE) {
      const cutoff = now - DEDUP_WINDOW_MS;
      for (const [key, ts] of this.seen) {
        if (ts <= cutoff) {
          this.seen.delete(key);
        }
      }
    }
    if (this.seen.has(id)) {
      return true;
    }
    this.seen.set(id, now);
    return false;
  }
}

export type QqbotPairingAccess = ReturnType<typeof createScopedPairingAccess>;

export type QqbotInboundHandlerParams = {
  message: QqbotInboundMessage;
  account: ResolvedQqbotAccount;
  config: CoreConfig;
  runtime: RuntimeEnv;
  core: PluginRuntime;
  context: QqbotAccountContext;
  pairing: QqbotPairingAccess;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
};

/**
 * Access gate + agent dispatch for one normalized inbound message.
 *
 * DM policy "pairing" is a real policy: unknown senders get a pairing code
 * and the pairing store decides who is allowed in.
 */
export async function handleQqbotInbound(params: QqbotInboundHandlerParams): Promise<void> {
  const { message, account, config: cfg, runtime, core, context, pairing } = params;

  if (message.chatKind === "dm") {
    // QQ guild DMs have no v2 reply endpoint — reject explicitly instead of
    // posting a request that can never succeed.
    runtime.log?.(
      `qqbot: drop guild direct message from ${message.senderId} (guild DM replies are unsupported by the QQ v2 API)`,
    );
    return;
  }

  const isGroupLike = message.chatKind === "group" || message.chatKind === "guild";
  const storeAllowFrom = await readQqbotStoreAllowFrom({
    account,
    readStore: pairing.readStoreForDmPolicy,
  });
  const access = resolveDmGroupAccessWithLists({
    isGroup: isGroupLike,
    dmPolicy: account.dmPolicy,
    groupPolicy: account.groupPolicy,
    allowFrom: account.allowFrom,
    groupAllowFrom: account.groupAllowFrom,
    storeAllowFrom,
    groupAllowFromFallbackToAllowFrom: false,
    isSenderAllowed: (allowFrom) =>
      isGroupLike
        ? allowListMatches(allowFrom, message.chatId)
        : allowListMatches(allowFrom, message.senderId),
  });
  if (access.decision === "pairing") {
    await issuePairingChallenge({
      channel: CHANNEL_ID,
      senderId: message.senderId,
      senderIdLine: `Your QQ openid: ${message.senderId}`,
      meta: { name: message.senderName },
      upsertPairingRequest: pairing.upsertPairingRequest,
      sendPairingReply: async (text) => {
        await context.sendText({ chatId: message.chatId, text });
        params.statusSink?.({ lastOutboundAt: Date.now() });
      },
      onReplyError: (err) => {
        runtime.error?.(`qqbot: pairing reply failed for ${message.senderId}: ${String(err)}`);
      },
    });
    return;
  }
  if (access.decision === "block") {
    runtime.log?.(
      `qqbot: drop ${message.chatKind} message from ${message.senderId} (policy=${
        isGroupLike ? account.groupPolicy : account.dmPolicy
      })`,
    );
    return;
  }

  const body = message.content.trim();
  if (!body && message.attachments.length === 0) {
    return;
  }

  const route = core.channel.routing.resolveAgentRoute({
    cfg,
    channel: "qqbot",
    accountId: account.accountId,
    peer: { kind: isGroupLike ? "group" : "direct", id: message.chatId },
  });
  const storePath = core.channel.session.resolveStorePath(cfg.session?.store, {
    agentId: route.agentId,
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });
  const formattedBody = core.channel.reply.formatAgentEnvelope({
    channel: "QQ",
    from: message.senderName || message.senderId,
    timestamp: message.timestamp,
    previousTimestamp,
    envelope: envelopeOptions,
    body,
  });

  const msgCtx = core.channel.reply.finalizeInboundContext({
    Body: formattedBody,
    RawBody: body,
    CommandBody: body,
    From: isGroupLike ? `qqbot:group:${message.chatId}` : `qqbot:${message.senderId}`,
    To: `qqbot:${message.chatId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId ?? account.accountId,
    ChatType: isGroupLike ? "group" : "direct",
    ConversationLabel: message.chatId,
    SenderName: message.senderName || message.senderId,
    SenderId: message.senderId,
    Provider: "qqbot",
    Surface: "qqbot",
    WasMentioned: message.isMention,
    MessageSid: message.messageId,
    Timestamp: message.timestamp,
    ...buildAgentMediaPayload(
      message.attachments.map((attachment) => ({
        path: attachment.url,
        contentType: attachment.contentType || undefined,
      })),
    ),
    OriginatingChannel: "qqbot",
    OriginatingTo: `qqbot:${message.chatId}`,
    CommandAuthorized: false,
  });

  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: msgCtx,
    cfg,
    dispatcherOptions: {
      deliver: async (payload: { text?: string; body?: string }) => {
        const text = payload?.text ?? payload?.body ?? "";
        if (!text.trim()) {
          return;
        }
        await context.sendText({
          chatId: message.chatId,
          text,
          replyTo: message.messageId,
        });
        params.statusSink?.({ lastOutboundAt: Date.now() });
        core.channel.activity.record({
          channel: "qqbot",
          accountId: account.accountId,
          direction: "outbound",
        });
      },
    },
  });
}

export async function monitorQqbotProvider(
  opts: QqbotMonitorOptions,
): Promise<{ stop: () => void }> {
  const core = getQqbotRuntime();
  const cfg = (opts.config ?? (await core.config.loadConfig())) as CoreConfig;
  const account = resolveQqbotAccount({ cfg, accountId: opts.accountId });

  if (!account.configured) {
    throw new Error(
      `QQBot is not configured for account "${account.accountId}" (need appId + appSecret/clientSecret in channels.qqbot or QQ_APP_ID/QQ_APP_SECRET).`,
    );
  }

  const runtime: RuntimeEnv =
    opts.runtime ??
    createLoggerBackedRuntime({
      logger: core.logging.getChildLogger(),
      exitError: () => new Error("Runtime exit not available"),
    });
  const logger = core.logging.getChildLogger({ channel: "qqbot", accountId: account.accountId });
  const context = getQqbotAccountContext(account);
  context.log = (message) => runtime.log?.(message);
  const pairing = createScopedPairingAccess({
    core,
    channel: CHANNEL_ID,
    accountId: account.accountId,
  });
  const deduper = new InboundDeduper();

  const handleInbound = async (message: QqbotInboundMessage): Promise<void> => {
    opts.statusSink?.({ lastInboundAt: message.timestamp });
    context.rememberChatKind(message.chatId, message.chatKind);

    if (opts.onMessage) {
      await opts.onMessage(message);
      return;
    }

    await handleQqbotInbound({
      message,
      account,
      config: cfg,
      runtime,
      core,
      context,
      pairing,
      statusSink: opts.statusSink,
    });
  };

  const gateway = new QqbotGateway({
    client: context.client,
    tokenManager: context.tokenManager,
    intents: account.intents,
    log: {
      info: (msg) => logger.info?.(msg),
      warn: (msg) => logger.warn?.(msg),
      error: (msg) => logger.error?.(msg),
    },
    events: {
      onDispatch: (eventType, d, seq) => {
        const message = normalizeQqbotEvent(eventType, d, seq);
        if (!message) {
          runtime.log?.(`qqbot: unhandled dispatch event ${eventType}`);
          return;
        }
        if (deduper.isDuplicate(message.messageId)) {
          return;
        }
        core.channel.activity.record({
          channel: "qqbot",
          accountId: account.accountId,
          direction: "inbound",
          at: message.timestamp,
        });
        void handleInbound(message).catch((err) => {
          logger.error?.(`qqbot: inbound dispatch failed: ${String(err)}`);
        });
      },
    },
  });

  const onAbort = () => {
    logger.info?.(`[qqbot] stopping provider (account ${account.accountId})`);
    gateway.stop();
  };
  if (opts.abortSignal) {
    if (opts.abortSignal.aborted) {
      onAbort();
      return { stop: () => undefined };
    }
    opts.abortSignal.addEventListener("abort", onAbort, { once: true });
  }

  logger.info?.(
    `[qqbot] starting provider (account ${account.accountId}, sandbox=${account.sandbox})`,
  );
  await gateway.start();

  return {
    stop: () => {
      opts.abortSignal?.removeEventListener("abort", onAbort);
      gateway.stop();
    },
  };
}
