import { afterEach, describe, expect, it, vi } from "vitest";
import { probeQqbot } from "./probe.js";
import { clearQqbotAccountContexts } from "./send.js";
import type { CoreConfig } from "./types.js";

const ENV_KEYS = ["QQ_APP_ID", "QQ_APP_SECRET", "QQ_CLIENT_SECRET"] as const;

function withEnvCleared(): () => void {
  const saved = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
  return () => {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

function config(appId: string, appSecret?: string): CoreConfig {
  return {
    channels: {
      qqbot: { appId, ...(appSecret ? { appSecret } : {}) },
    },
  } as unknown as CoreConfig;
}

afterEach(() => {
  clearQqbotAccountContexts();
});

describe("probeQqbot", () => {
  it("masks the AppID in the probe payload", async () => {
    const restore = withEnvCleared();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => JSON.stringify({ access_token: "TOKEN", expires_in: 7200 }),
      })),
    );
    try {
      const probe = await probeQqbot(config("1234567890", "secret"));
      expect(probe.ok).toBe(true);
      expect(probe.appId).toBe("1234***");
      expect(probe.appId).not.toContain("1234567890");
    } finally {
      restore();
    }
  });

  it("masks the AppID when the account is not configured", async () => {
    const restore = withEnvCleared();
    try {
      const probe = await probeQqbot(config("1234567890"));
      expect(probe.ok).toBe(false);
      expect(probe.appId).toBe("1234***");
    } finally {
      restore();
    }
  });
});
