import {
  createScopedPairingAccess,
  type PluginRuntime,
  type RuntimeEnv,
} from "paleoclaw/plugin-sdk/qqbot";
import { describe, expect, it, vi } from "vitest";
import { handleQqbotInbound } from "./monitor.js";
import type { QqbotAccountContext } from "./send.js";
import type { CoreConfig, QqbotInboundMessage, ResolvedQqbotAccount } from "./types.js";

type PairingRequestInput = { id: string; meta?: Record<string, string | undefined> };

function createHarness(options?: { storeAllowFrom?: string[] }) {
  const dispatched: Array<Record<string, unknown>> = [];
  const pairingRequests: PairingRequestInput[] = [];
  const sentTexts: Array<{ chatId: string; text: string }> = [];

  const readAllowFromStore = vi.fn(async () => options?.storeAllowFrom ?? []);
  const upsertPairingRequest = vi.fn(async (input: PairingRequestInput) => {
    pairingRequests.push(input);
    return { code: "PAIR123", created: true };
  });
  const dispatchReplyWithBufferedBlockDispatcher = vi.fn(
    async (params: { ctx: Record<string, unknown> }) => {
      dispatched.push(params.ctx);
    },
  );

  const core = {
    channel: {
      pairing: { readAllowFromStore, upsertPairingRequest },
      routing: {
        resolveAgentRoute: () => ({
          agentId: "main",
          sessionKey: "agent:main:qqbot:default",
          accountId: "default",
        }),
      },
      session: {
        resolveStorePath: () => "/tmp/qqbot-store",
        readSessionUpdatedAt: () => undefined,
      },
      reply: {
        resolveEnvelopeFormatOptions: () => ({}),
        formatAgentEnvelope: (params: { body: string }) => params.body,
        finalizeInboundContext: (ctx: Record<string, unknown>) => ctx,
        dispatchReplyWithBufferedBlockDispatcher,
      },
      activity: { record: () => undefined },
    },
  } as unknown as PluginRuntime;

  const context = {
    sendText: vi.fn(async (params: { chatId: string; text: string }) => {
      sentTexts.push(params);
      return { channelId: params.chatId, messageId: "out-1" };
    }),
  } as unknown as QqbotAccountContext;

  const runtime = {
    log: vi.fn(),
    error: vi.fn(),
  } as unknown as RuntimeEnv;

  return {
    core,
    context,
    runtime,
    dispatched,
    pairingRequests,
    sentTexts,
    readAllowFromStore,
    upsertPairingRequest,
  };
}

function account(overrides?: Partial<ResolvedQqbotAccount>): ResolvedQqbotAccount {
  return {
    accountId: "default",
    enabled: true,
    configured: true,
    appId: "app-1",
    clientSecret: "sec-1",
    secretSource: "config:appSecret",
    mode: "websocket",
    sandbox: false,
    markdown: true,
    intents: 0,
    dmPolicy: "pairing",
    allowFrom: [],
    groupPolicy: "allowlist",
    groupAllowFrom: [],
    ...overrides,
  };
}

type QqbotMessageOverrides = Partial<Omit<QqbotInboundMessage, "messageId" | "chatKind">>;

function dm(senderId: string, overrides?: QqbotMessageOverrides): QqbotInboundMessage {
  return {
    eventType: "C2C_MESSAGE_CREATE",
    chatKind: "c2c",
    messageId: "m-1",
    chatId: senderId,
    senderId,
    content: "hello",
    rawContent: "hello",
    isMention: false,
    attachments: [],
    timestamp: 1_700_000_000_000,
    raw: {},
    ...overrides,
  };
}

async function runInbound(params: {
  harness: ReturnType<typeof createHarness>;
  account: ResolvedQqbotAccount;
  message: QqbotInboundMessage;
}): Promise<void> {
  const { harness, account: resolvedAccount, message } = params;
  await handleQqbotInbound({
    message,
    account: resolvedAccount,
    config: { channels: { qqbot: {} } } as unknown as CoreConfig,
    runtime: harness.runtime,
    core: harness.core,
    context: harness.context,
    pairing: createScopedPairingAccess({
      core: harness.core,
      channel: "qqbot",
      accountId: resolvedAccount.accountId,
    }),
  });
}

describe("qqbot inbound access gate", () => {
  it("dmPolicy=pairing: unknown sender is paired (no agent dispatch) and gets a pairing code", async () => {
    const harness = createHarness();

    await runInbound({
      harness,
      account: account({ dmPolicy: "pairing" }),
      message: dm("alice"),
    });

    expect(harness.dispatched).toHaveLength(0);
    expect(harness.upsertPairingRequest).toHaveBeenCalledTimes(1);
    expect(harness.pairingRequests[0]?.id).toBe("alice");
    expect(harness.sentTexts).toHaveLength(1);
    expect(harness.sentTexts[0]?.chatId).toBe("alice");
    expect(harness.sentTexts[0]?.text).toContain("PAIR123");
  });

  it("dmPolicy=pairing: sender present in the pairing store reaches the agent", async () => {
    const harness = createHarness({ storeAllowFrom: ["alice"] });

    await runInbound({
      harness,
      account: account({ dmPolicy: "pairing" }),
      message: dm("alice"),
    });

    expect(harness.dispatched).toHaveLength(1);
    expect(harness.upsertPairingRequest).not.toHaveBeenCalled();
    expect(harness.sentTexts).toHaveLength(0);
  });

  it("dmPolicy=allowlist: only allowlisted senders reach the agent", async () => {
    const harness = createHarness();

    await runInbound({
      harness,
      account: account({ dmPolicy: "allowlist", allowFrom: ["bob"] }),
      message: dm("alice"),
    });
    expect(harness.dispatched).toHaveLength(0);
    // The store is not consulted for the allowlist policy.
    expect(harness.readAllowFromStore).not.toHaveBeenCalled();
    expect(harness.upsertPairingRequest).not.toHaveBeenCalled();

    await runInbound({
      harness,
      account: account({ dmPolicy: "allowlist", allowFrom: ["bob"] }),
      message: dm("bob"),
    });
    expect(harness.dispatched).toHaveLength(1);
  });

  it("carries inbound attachments into the agent context as media fields", async () => {
    const harness = createHarness();

    await runInbound({
      harness,
      account: account({ dmPolicy: "open" }),
      message: dm("alice", {
        attachments: [
          { contentType: "image/png", url: "https://multimedia.qq.com/a.png" },
          { contentType: "video/mp4", url: "https://multimedia.qq.com/b.mp4" },
        ],
      }),
    });

    expect(harness.dispatched).toHaveLength(1);
    const ctx = harness.dispatched[0];
    expect(ctx.MediaUrl).toBe("https://multimedia.qq.com/a.png");
    expect(ctx.MediaType).toBe("image/png");
    expect(ctx.MediaUrls).toEqual([
      "https://multimedia.qq.com/a.png",
      "https://multimedia.qq.com/b.mp4",
    ]);
    expect(ctx.MediaPaths).toEqual([
      "https://multimedia.qq.com/a.png",
      "https://multimedia.qq.com/b.mp4",
    ]);
    expect(ctx.MediaTypes).toEqual(["image/png", "video/mp4"]);
  });

  it("drops guild direct messages (no v2 guild DM reply endpoint)", async () => {
    const harness = createHarness();

    const guildDm: QqbotInboundMessage = {
      eventType: "DIRECT_MESSAGE_CREATE",
      chatKind: "dm",
      messageId: "m-2",
      chatId: "guild-1",
      senderId: "u-1",
      content: "hello",
      rawContent: "hello",
      isMention: false,
      attachments: [],
      timestamp: 1_700_000_000_000,
      raw: {},
    };
    await runInbound({
      harness,
      account: account({ dmPolicy: "open" }),
      message: guildDm,
    });

    expect(harness.dispatched).toHaveLength(0);
    expect(harness.sentTexts).toHaveLength(0);
  });
});
