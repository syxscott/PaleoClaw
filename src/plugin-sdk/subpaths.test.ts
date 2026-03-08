import * as compatSdk from "paleoclaw/plugin-sdk/compat";
import * as discordSdk from "paleoclaw/plugin-sdk/discord";
import * as imessageSdk from "paleoclaw/plugin-sdk/imessage";
import * as lineSdk from "paleoclaw/plugin-sdk/line";
import * as msteamsSdk from "paleoclaw/plugin-sdk/msteams";
import * as signalSdk from "paleoclaw/plugin-sdk/signal";
import * as slackSdk from "paleoclaw/plugin-sdk/slack";
import * as telegramSdk from "paleoclaw/plugin-sdk/telegram";
import * as whatsappSdk from "paleoclaw/plugin-sdk/whatsapp";
import { describe, expect, it } from "vitest";

const bundledExtensionSubpathLoaders = [
  { id: "acpx", load: () => import("paleoclaw/plugin-sdk/acpx") },
  { id: "bluebubbles", load: () => import("paleoclaw/plugin-sdk/bluebubbles") },
  { id: "copilot-proxy", load: () => import("paleoclaw/plugin-sdk/copilot-proxy") },
  { id: "device-pair", load: () => import("paleoclaw/plugin-sdk/device-pair") },
  { id: "diagnostics-otel", load: () => import("paleoclaw/plugin-sdk/diagnostics-otel") },
  { id: "diffs", load: () => import("paleoclaw/plugin-sdk/diffs") },
  { id: "feishu", load: () => import("paleoclaw/plugin-sdk/feishu") },
  {
    id: "google-gemini-cli-auth",
    load: () => import("paleoclaw/plugin-sdk/google-gemini-cli-auth"),
  },
  { id: "googlechat", load: () => import("paleoclaw/plugin-sdk/googlechat") },
  { id: "irc", load: () => import("paleoclaw/plugin-sdk/irc") },
  { id: "llm-task", load: () => import("paleoclaw/plugin-sdk/llm-task") },
  { id: "lobster", load: () => import("paleoclaw/plugin-sdk/lobster") },
  { id: "matrix", load: () => import("paleoclaw/plugin-sdk/matrix") },
  { id: "mattermost", load: () => import("paleoclaw/plugin-sdk/mattermost") },
  { id: "memory-core", load: () => import("paleoclaw/plugin-sdk/memory-core") },
  { id: "memory-lancedb", load: () => import("paleoclaw/plugin-sdk/memory-lancedb") },
  {
    id: "minimax-portal-auth",
    load: () => import("paleoclaw/plugin-sdk/minimax-portal-auth"),
  },
  { id: "nextcloud-talk", load: () => import("paleoclaw/plugin-sdk/nextcloud-talk") },
  { id: "nostr", load: () => import("paleoclaw/plugin-sdk/nostr") },
  { id: "open-prose", load: () => import("paleoclaw/plugin-sdk/open-prose") },
  { id: "phone-control", load: () => import("paleoclaw/plugin-sdk/phone-control") },
  { id: "qwen-portal-auth", load: () => import("paleoclaw/plugin-sdk/qwen-portal-auth") },
  { id: "synology-chat", load: () => import("paleoclaw/plugin-sdk/synology-chat") },
  { id: "talk-voice", load: () => import("paleoclaw/plugin-sdk/talk-voice") },
  { id: "test-utils", load: () => import("paleoclaw/plugin-sdk/test-utils") },
  { id: "thread-ownership", load: () => import("paleoclaw/plugin-sdk/thread-ownership") },
  { id: "tlon", load: () => import("paleoclaw/plugin-sdk/tlon") },
  { id: "twitch", load: () => import("paleoclaw/plugin-sdk/twitch") },
  { id: "voice-call", load: () => import("paleoclaw/plugin-sdk/voice-call") },
  { id: "zalo", load: () => import("paleoclaw/plugin-sdk/zalo") },
  { id: "zalouser", load: () => import("paleoclaw/plugin-sdk/zalouser") },
] as const;

describe("plugin-sdk subpath exports", () => {
  it("exports compat helpers", () => {
    expect(typeof compatSdk.emptyPluginConfigSchema).toBe("function");
    expect(typeof compatSdk.resolveControlCommandGate).toBe("function");
  });

  it("exports Discord helpers", () => {
    expect(typeof discordSdk.resolveDiscordAccount).toBe("function");
    expect(typeof discordSdk.inspectDiscordAccount).toBe("function");
    expect(typeof discordSdk.discordOnboardingAdapter).toBe("object");
  });

  it("exports Slack helpers", () => {
    expect(typeof slackSdk.resolveSlackAccount).toBe("function");
    expect(typeof slackSdk.inspectSlackAccount).toBe("function");
    expect(typeof slackSdk.handleSlackMessageAction).toBe("function");
  });

  it("exports Telegram helpers", () => {
    expect(typeof telegramSdk.resolveTelegramAccount).toBe("function");
    expect(typeof telegramSdk.inspectTelegramAccount).toBe("function");
    expect(typeof telegramSdk.telegramOnboardingAdapter).toBe("object");
  });

  it("exports Signal helpers", () => {
    expect(typeof signalSdk.resolveSignalAccount).toBe("function");
    expect(typeof signalSdk.signalOnboardingAdapter).toBe("object");
  });

  it("exports iMessage helpers", () => {
    expect(typeof imessageSdk.resolveIMessageAccount).toBe("function");
    expect(typeof imessageSdk.imessageOnboardingAdapter).toBe("object");
  });

  it("exports WhatsApp helpers", () => {
    expect(typeof whatsappSdk.resolveWhatsAppAccount).toBe("function");
    expect(typeof whatsappSdk.whatsappOnboardingAdapter).toBe("object");
  });

  it("exports LINE helpers", () => {
    expect(typeof lineSdk.processLineMessage).toBe("function");
    expect(typeof lineSdk.createInfoCard).toBe("function");
  });

  it("exports Microsoft Teams helpers", () => {
    expect(typeof msteamsSdk.resolveControlCommandGate).toBe("function");
    expect(typeof msteamsSdk.loadOutboundMediaFromUrl).toBe("function");
  });

  it("resolves bundled extension subpaths", async () => {
    for (const { id, load } of bundledExtensionSubpathLoaders) {
      const mod = await load();
      expect(typeof mod).toBe("object");
      expect(mod, `subpath ${id} should resolve`).toBeTruthy();
    }
  });
});
