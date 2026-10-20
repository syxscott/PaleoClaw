import { afterEach, describe, expect, it, vi } from "vitest";
import { QQBOT_API_BASE, QQBOT_SANDBOX_API_BASE } from "./constants.js";
import {
  clearQqbotAccountContext,
  clearQqbotAccountContexts,
  getQqbotAccountContext,
} from "./send.js";
import type { ResolvedQqbotAccount } from "./types.js";

function account(overrides?: Partial<ResolvedQqbotAccount>): ResolvedQqbotAccount {
  return {
    accountId: "default",
    enabled: true,
    configured: true,
    appId: "app-1",
    clientSecret: "secret-a",
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

function stubFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ access_token: "TOKEN", expires_in: 7200, id: "out-1" }),
    text: async () => JSON.stringify({ access_token: "TOKEN", expires_in: 7200, id: "out-1" }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  clearQqbotAccountContexts();
});

describe("qqbot account context cache", () => {
  it("reuses the cached context while the credentials are unchanged", () => {
    clearQqbotAccountContexts();
    const first = getQqbotAccountContext(account());
    const second = getQqbotAccountContext(account());
    expect(second).toBe(first);
  });

  it("rebuilds the token manager and client after the secret is rotated", async () => {
    clearQqbotAccountContexts();
    const fetchMock = stubFetch();

    const first = getQqbotAccountContext(account({ clientSecret: "secret-a" }));
    await first.tokenManager.getToken();
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("secret-a");

    const second = getQqbotAccountContext(account({ clientSecret: "secret-b" }));
    expect(second).not.toBe(first);
    expect(second.tokenManager).not.toBe(first.tokenManager);
    expect(second.client).not.toBe(first.client);
    expect(second.account.clientSecret).toBe("secret-b");

    await second.tokenManager.getToken();
    const lastBody = String(fetchMock.mock.calls.at(-1)?.[1]?.body);
    expect(lastBody).toContain("secret-b");
    expect(lastBody).not.toContain("secret-a");
  });

  it("rebuilds the client when the sandbox mode flips", () => {
    clearQqbotAccountContexts();
    const prod = getQqbotAccountContext(account({ sandbox: false }));
    expect(prod.client.apiBase).toBe(QQBOT_API_BASE);

    const sandbox = getQqbotAccountContext(account({ sandbox: true }));
    expect(sandbox).not.toBe(prod);
    expect(sandbox.client.apiBase).toBe(QQBOT_SANDBOX_API_BASE);
  });

  it("keeps the learned chat kinds when the context is rebuilt", () => {
    clearQqbotAccountContexts();
    const first = getQqbotAccountContext(account());
    first.rememberChatKind("channel-1", "guild");

    const rotated = getQqbotAccountContext(account({ clientSecret: "secret-b" }));
    expect(rotated.resolveChatKind("channel-1")).toBe("guild");
  });

  it("drops the cached context of a removed account", () => {
    clearQqbotAccountContexts();
    const first = getQqbotAccountContext(account({ accountId: "work" }));
    clearQqbotAccountContext("work");
    expect(getQqbotAccountContext(account({ accountId: "work" }))).not.toBe(first);
  });
});

describe("qqbot outbound target contract", () => {
  it("refuses to reply to guild DMs without issuing a request", async () => {
    clearQqbotAccountContexts();
    const fetchMock = stubFetch();
    const context = getQqbotAccountContext(account());
    context.rememberChatKind("guild-1", "dm");

    await expect(context.sendText({ chatId: "guild-1", text: "hi" })).rejects.toThrow(
      /guild direct messages/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the caption as a guild text message instead of uploading guild media", async () => {
    clearQqbotAccountContexts();
    const fetchMock = stubFetch();
    const context = getQqbotAccountContext(account());
    context.rememberChatKind("channel-1", "guild");

    const result = await context.sendMedia({
      chatId: "channel-1",
      mediaUrl: "https://example.com/photo.png",
      caption: "look at this",
    });

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("/files"))).toBe(false);
    expect(urls.some((url) => url.includes("/channels/channel-1/messages"))).toBe(true);
    expect(result.messageId).toBe("out-1");
  });
});
