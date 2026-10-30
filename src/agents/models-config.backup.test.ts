import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveOpenClawAgentDir } from "./agent-paths.js";
import {
  installModelsConfigTestHooks,
  MODELS_CONFIG_IMPLICIT_ENV_VARS,
  unsetEnv,
  withModelsTempHome as withTempHome,
} from "./models-config.e2e-harness.js";
import { ensureOpenClawModelsJson, MODELS_JSON_BACKUP_COUNT } from "./models-config.js";

installModelsConfigTestHooks();

const MODELS_JSON_NAME = "models.json";

function modelsPath(): string {
  return path.join(resolveOpenClawAgentDir(), MODELS_JSON_NAME);
}

async function readModelsJson(): Promise<{
  providers: Record<
    string,
    { baseUrl?: string; apiKey?: string; models?: Array<{ name?: string }> }
  >;
}> {
  const raw = await fs.readFile(modelsPath(), "utf8");
  return JSON.parse(raw) as {
    providers: Record<
      string,
      { baseUrl?: string; apiKey?: string; models?: Array<{ name?: string }> }
    >;
  };
}

function createProviderConfig(params: {
  provider: string;
  baseUrl: string;
  apiKey?: string;
  modelName: string;
}): OpenClawConfig {
  const provider: Record<string, unknown> = {
    baseUrl: params.baseUrl,
    api: "openai-completions",
    models: [
      {
        id: "proxy-model",
        name: params.modelName,
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 8192,
        maxTokens: 2048,
      },
    ],
  };
  if (params.apiKey) {
    provider.apiKey = params.apiKey;
  }
  return {
    models: {
      providers: {
        [params.provider]: provider,
      },
    },
  } as OpenClawConfig;
}

async function writeAgentModelsJson(content: unknown): Promise<void> {
  const agentDir = resolveOpenClawAgentDir();
  await fs.mkdir(agentDir, { recursive: true });
  await fs.writeFile(modelsPath(), `${JSON.stringify(content, null, 2)}\n`, "utf8");
}

describe("models.json provider switching safety", () => {
  it("keeps a bounded backup ring of the previous provider set", async () => {
    await withTempHome(async () => {
      for (let index = 0; index < MODELS_JSON_BACKUP_COUNT + 2; index += 1) {
        await ensureOpenClawModelsJson(
          createProviderConfig({
            provider: "custom",
            baseUrl: "http://127.0.0.1:4000/v1",
            apiKey: "TEST_KEY",
            modelName: `model-${index}`,
          }),
        );
      }

      const readBackup = async (suffix: string): Promise<string | null> => {
        try {
          return await fs.readFile(`${modelsPath()}${suffix}`, "utf8");
        } catch {
          return null;
        }
      };

      const current = await readModelsJson();
      expect(current.providers.custom?.models?.[0]?.name).toBe(
        `model-${MODELS_JSON_BACKUP_COUNT + 1}`,
      );

      const primary = await readBackup(".bak");
      expect(primary).toBeTruthy();
      expect(
        (
          JSON.parse(primary as string) as {
            providers: Record<string, { models?: Array<{ name?: string }> }>;
          }
        ).providers.custom?.models?.[0]?.name,
      ).toBe(`model-${MODELS_JSON_BACKUP_COUNT}`);
      expect(await readBackup(`.bak.${MODELS_JSON_BACKUP_COUNT}`)).toBeNull();
    });
  });

  it("never persists a plaintext credential in a backup", async () => {
    await withTempHome(async () => {
      await writeAgentModelsJson({
        providers: {
          custom: {
            baseUrl: "http://127.0.0.1:4000/v1",
            apiKey: "SUPER_SECRET_LITERAL", // pragma: allowlist secret
            models: [],
          },
        },
      });

      await ensureOpenClawModelsJson(
        createProviderConfig({
          provider: "custom",
          baseUrl: "http://127.0.0.1:4001/v1",
          apiKey: "TEST_KEY",
          modelName: "rotated",
        }),
      );

      const backup = await fs.readFile(`${modelsPath()}.bak`, "utf8");
      expect(backup).not.toContain("SUPER_SECRET_LITERAL");
      expect(backup).toContain("redacted");
    });
  });

  it("keeps the previous credential when a provider switch does not supply one", async () => {
    await withTempHome(async () => {
      await writeAgentModelsJson({
        providers: {
          custom: {
            baseUrl: "http://127.0.0.1:4000/v1",
            apiKey: "AGENT_KEY", // pragma: allowlist secret
            api: "openai-completions",
            models: [
              {
                id: "proxy-model",
                name: "seeded",
                reasoning: false,
                input: ["text"],
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 8192,
                maxTokens: 2048,
              },
            ],
          },
        },
      });

      await ensureOpenClawModelsJson(
        createProviderConfig({
          provider: "custom",
          baseUrl: "http://127.0.0.1:4001/v1",
          modelName: "switched",
        }),
      );

      const parsed = await readModelsJson();
      expect(parsed.providers.custom?.apiKey).toBe("AGENT_KEY");
      expect(parsed.providers.custom?.baseUrl).toBe("http://127.0.0.1:4001/v1");
      const backup = await fs.readFile(`${modelsPath()}.bak`, "utf8");
      expect(backup).not.toContain("AGENT_KEY");
    });
  });

  it("keeps the previous credential of a provider that survives a replace-mode switch", async () => {
    await withTempHome(async () => {
      await writeAgentModelsJson({
        providers: {
          custom: {
            baseUrl: "http://127.0.0.1:4000/v1",
            apiKey: "AGENT_KEY", // pragma: allowlist secret
            api: "openai-completions",
            models: [],
          },
        },
      });

      const config = createProviderConfig({
        provider: "custom",
        baseUrl: "http://127.0.0.1:4001/v1",
        modelName: "switched",
      });
      const replaceConfig = {
        ...config,
        models: { ...config.models, mode: "replace" as const },
      } as OpenClawConfig;

      await ensureOpenClawModelsJson(replaceConfig);

      const parsed = await readModelsJson();
      expect(parsed.providers.custom?.apiKey).toBe("AGENT_KEY");
    });
  });

  it("retains the previous configuration when the pre-flight fails", async () => {
    await withTempHome(async () => {
      await writeAgentModelsJson({
        providers: {
          custom: {
            baseUrl: "http://127.0.0.1:4000/v1",
            apiKey: "AGENT_KEY", // pragma: allowlist secret
            api: "openai-completions",
            models: [],
          },
        },
      });
      const before = await fs.readFile(modelsPath(), "utf8");

      const failingFetch = vi.fn(async () => {
        throw new Error("network down");
      });
      const result = await ensureOpenClawModelsJson(
        createProviderConfig({
          provider: "other",
          baseUrl: "http://127.0.0.1:4002/v1",
          apiKey: "OTHER_KEY", // pragma: allowlist secret
          modelName: "new-provider",
        }),
        undefined,
        { preflight: { enabled: true, fetchImpl: failingFetch } },
      );

      expect(result.wrote).toBe(false);
      expect(failingFetch).toHaveBeenCalled();
      expect(await fs.readFile(modelsPath(), "utf8")).toBe(before);
      const parsed = await readModelsJson();
      expect(parsed.providers.custom).toBeDefined();
      expect(parsed.providers.other).toBeUndefined();
    });
  });

  it("does not add a provider that fails the pre-flight in merge mode", async () => {
    await withTempHome(async () => {
      await writeAgentModelsJson({
        providers: {
          custom: {
            baseUrl: "http://127.0.0.1:4000/v1",
            apiKey: "AGENT_KEY", // pragma: allowlist secret
            api: "openai-completions",
            models: [],
          },
        },
      });

      const failingFetch = vi.fn(async () => {
        throw new Error("network down");
      });
      const result = await ensureOpenClawModelsJson(
        createProviderConfig({
          provider: "other",
          baseUrl: "http://127.0.0.1:4002/v1",
          apiKey: "OTHER_KEY", // pragma: allowlist secret
          modelName: "new-provider",
        }),
        undefined,
        { preflight: { enabled: true, fetchImpl: failingFetch } },
      );

      expect(result.wrote).toBe(false);
      const parsed = await readModelsJson();
      expect(parsed.providers.custom).toBeDefined();
      expect(parsed.providers.other).toBeUndefined();
    });
  });

  it("writes the new configuration when the pre-flight succeeds", async () => {
    await withTempHome(async () => {
      await writeAgentModelsJson({
        providers: {
          custom: {
            baseUrl: "http://127.0.0.1:4000/v1",
            apiKey: "AGENT_KEY", // pragma: allowlist secret
            api: "openai-completions",
            models: [],
          },
        },
      });

      const okFetch = vi.fn(async () => new Response("{}", { status: 200 }));
      const result = await ensureOpenClawModelsJson(
        createProviderConfig({
          provider: "other",
          baseUrl: "http://127.0.0.1:4002/v1",
          apiKey: "OTHER_KEY", // pragma: allowlist secret
          modelName: "new-provider",
        }),
        undefined,
        { preflight: { enabled: true, fetchImpl: okFetch } },
      );

      expect(result.wrote).toBe(true);
      const parsed = await readModelsJson();
      expect(parsed.providers.other?.baseUrl).toBe("http://127.0.0.1:4002/v1");
      expect(await fs.readFile(`${modelsPath()}.bak`, "utf8")).toContain("custom");
    });
  });

  it("fails the pre-flight when the referenced credential env var is missing", async () => {
    await withTempHome(async () => {
      unsetEnv([...MODELS_CONFIG_IMPLICIT_ENV_VARS, "OPENAI_API_KEY"]);
      const result = await ensureOpenClawModelsJson(
        createProviderConfig({
          provider: "openai-like",
          baseUrl: "http://127.0.0.1:4003/v1",
          apiKey: "OPENAI_API_KEY", // pragma: allowlist secret
          modelName: "missing-credential",
        }),
        undefined,
        { preflight: { enabled: true } },
      );

      expect(result.wrote).toBe(false);
      await expect(fs.stat(modelsPath())).rejects.toThrow();
    });
  });
});
