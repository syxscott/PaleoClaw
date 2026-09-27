/**
 * QQ monitor: runs the WebSocket gateway for one account and dispatches
 * normalized inbound events to the agent runtime (inbound pipeline mirrors
 * extensions/irc + extensions/synology-chat: ACL gate → dedupe → route →
 * envelope → buffered block dispatcher → QQ REST reply with passive msg_id).
 */

import { createLoggerBackedRuntime, type RuntimeEnv } from "paleoclaw/plugin-sdk/qqbot";
import { isDmIntakeAllowed, isGroupAllowed, resolveQqbotAccount } from "./accounts.js";
import { QqbotGateway } from "./gateway.js";
import { normalizeQqbotEvent } from "./normalize.js";
import { getQqbotRuntime } from "./runtime.js";
import { getQqbotAccountContext } from "./send.js";
import type { CoreConfig, QqbotInboundMessage } from "./types.js";

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
  const deduper = new InboundDeduper();

  const handleInbound = async (message: QqbotInboundMessage): Promise<void> => {
    opts.statusSink?.({ lastInboundAt: message.timestamp });
    context.rememberChatKind(message.chatId, message.chatKind);

    if (opts.onMessage) {
      await opts.onMessage(message);
      return;
    }

    const isGroupLike = message.chatKind === "group" || message.chatKind === "guild";
    const allowed = isGroupLike
      ? isGroupAllowed(account, message.chatId)
      : isDmIntakeAllowed(account, message.senderId);
    if (!allowed) {
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
          opts.statusSink?.({ lastOutboundAt: Date.now() });
          core.channel.activity.record({
            channel: "qqbot",
            accountId: account.accountId,
            direction: "outbound",
          });
        },
      },
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
