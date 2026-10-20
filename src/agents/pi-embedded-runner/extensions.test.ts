import type { Api, Model } from "@mariozechner/pi-ai";
import type { SessionManager } from "@mariozechner/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { getCompactionSafeguardRuntime } from "../pi-extensions/compaction-safeguard-runtime.js";
import compactionSafeguardExtension from "../pi-extensions/compaction-safeguard.js";
import { buildEmbeddedExtensionFactories } from "./extensions.js";
import { log } from "./logger.js";

describe("buildEmbeddedExtensionFactories", () => {
  it("does not opt safeguard mode into quality-guard retries", () => {
    const sessionManager = {} as SessionManager;
    const model = {
      id: "claude-sonnet-4-20250514",
      contextWindow: 200_000,
    } as Model<Api>;
    const cfg = {
      agents: {
        defaults: {
          compaction: {
            mode: "safeguard",
          },
        },
      },
    } as OpenClawConfig;

    const factories = buildEmbeddedExtensionFactories({
      cfg,
      sessionManager,
      provider: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      model,
    });

    expect(factories).toContain(compactionSafeguardExtension);
    expect(getCompactionSafeguardRuntime(sessionManager)).toMatchObject({
      qualityGuardEnabled: false,
    });
  });

  it("wires explicit safeguard quality-guard runtime flags", () => {
    const sessionManager = {} as SessionManager;
    const model = {
      id: "claude-sonnet-4-20250514",
      contextWindow: 200_000,
    } as Model<Api>;
    const cfg = {
      agents: {
        defaults: {
          compaction: {
            mode: "safeguard",
            qualityGuard: {
              enabled: true,
              maxRetries: 2,
            },
          },
        },
      },
    } as OpenClawConfig;

    const factories = buildEmbeddedExtensionFactories({
      cfg,
      sessionManager,
      provider: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      model,
    });

    expect(factories).toContain(compactionSafeguardExtension);
    expect(getCompactionSafeguardRuntime(sessionManager)).toMatchObject({
      qualityGuardEnabled: true,
      qualityGuardMaxRetries: 2,
    });
  });

  it("warns when cache-ttl pruning is requested for an ineligible provider", () => {
    const warnSpy = vi.spyOn(log, "warn").mockImplementation(() => undefined);
    try {
      const sessionManager = {} as SessionManager;
      const cfg = {
        agents: {
          defaults: {
            contextPruning: {
              mode: "cache-ttl",
            },
          },
        },
      } as OpenClawConfig;

      const factories = buildEmbeddedExtensionFactories({
        cfg,
        sessionManager,
        provider: "openai",
        modelId: "gpt-4o",
        model: undefined,
      });

      expect(factories).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const message = warnSpy.mock.calls[0]?.[0] ?? "";
      expect(message).toContain("openai/gpt-4o");
      expect(message).toContain("provider-capabilities.json");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does not warn when cache-ttl pruning is requested for an eligible provider", () => {
    const warnSpy = vi.spyOn(log, "warn").mockImplementation(() => undefined);
    try {
      const sessionManager = {} as SessionManager;
      const cfg = {
        agents: {
          defaults: {
            contextPruning: {
              mode: "cache-ttl",
            },
          },
        },
      } as OpenClawConfig;

      buildEmbeddedExtensionFactories({
        cfg,
        sessionManager,
        provider: "minimax-cn",
        modelId: "MiniMax-M2.5",
        model: undefined,
      });

      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
