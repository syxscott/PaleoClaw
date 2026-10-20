import fs from "node:fs/promises";
import path from "node:path";
import {
  getRuntimeConfigSnapshot,
  getRuntimeConfigSourceSnapshot,
  type OpenClawConfig,
  loadConfig,
} from "../config/config.js";
import { applyConfigEnvVars } from "../config/env-vars.js";
import { fetchWithSsrFGuard } from "../infra/net/fetch-guard.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { isRecord } from "../utils.js";
import { resolveOpenClawAgentDir } from "./agent-paths.js";
import { isNonSecretApiKeyMarker, isSecretRefHeaderValueMarker } from "./model-auth-markers.js";
import { resolveAwsSdkEnvVarName } from "./model-auth.js";
import {
  normalizeProviders,
  type ProviderConfig,
  resolveImplicitBedrockProvider,
  resolveImplicitCopilotProvider,
  resolveImplicitProviders,
} from "./models-config.providers.js";
import { BEDROCK_PROVIDER_ID, COPILOT_PROVIDER_ID } from "./provider-capabilities.js";

type ModelsConfig = NonNullable<OpenClawConfig["models"]>;

const log = createSubsystemLogger("agents/models-config");

const DEFAULT_MODE: NonNullable<ModelsConfig["mode"]> = "merge";
const MODELS_JSON_WRITE_LOCKS = new Map<string, Promise<void>>();

/**
 * Number of `models.json` backups kept on disk.
 *
 * Mirrors the config backup ring (`src/config/backup-rotation.ts`): the most
 * recent snapshot is `models.json.bak`, older ones are rotated into
 * `models.json.bak.1` … `models.json.bak.4`.
 */
export const MODELS_JSON_BACKUP_COUNT = 5;

/** Placeholder written instead of a plaintext credential in a backup. */
const REDACTED_SECRET_MARKER = "redacted";

/** Environment variable that switches the provider pre-flight on/off. */
export const PROVIDER_PREFLIGHT_ENV = "PALEOCLAW_PROVIDER_PREFLIGHT";

const PROVIDER_PREFLIGHT_TIMEOUT_MS = 5_000;

const ENV_VAR_NAME_RE = /^[A-Z_][A-Z0-9_]*$/;

function isPositiveFiniteTokenLimit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function resolvePreferredTokenLimit(params: {
  explicitPresent: boolean;
  explicitValue: unknown;
  implicitValue: unknown;
}): number | undefined {
  if (params.explicitPresent && isPositiveFiniteTokenLimit(params.explicitValue)) {
    return params.explicitValue;
  }
  if (isPositiveFiniteTokenLimit(params.implicitValue)) {
    return params.implicitValue;
  }
  return isPositiveFiniteTokenLimit(params.explicitValue) ? params.explicitValue : undefined;
}

function mergeProviderModels(implicit: ProviderConfig, explicit: ProviderConfig): ProviderConfig {
  const implicitModels = Array.isArray(implicit.models) ? implicit.models : [];
  const explicitModels = Array.isArray(explicit.models) ? explicit.models : [];
  if (implicitModels.length === 0) {
    return { ...implicit, ...explicit };
  }

  const getId = (model: unknown): string => {
    if (!model || typeof model !== "object") {
      return "";
    }
    const id = (model as { id?: unknown }).id;
    return typeof id === "string" ? id.trim() : "";
  };
  const implicitById = new Map(
    implicitModels.map((model) => [getId(model), model] as const).filter(([id]) => Boolean(id)),
  );
  const seen = new Set<string>();

  const mergedModels = explicitModels.map((explicitModel) => {
    const id = getId(explicitModel);
    if (!id) {
      return explicitModel;
    }
    seen.add(id);
    const implicitModel = implicitById.get(id);
    if (!implicitModel) {
      return explicitModel;
    }

    // Refresh capability metadata from the implicit catalog while preserving
    // user-specific fields (cost, headers, compat, etc.) on explicit entries.
    // reasoning is treated as user-overridable: if the user has explicitly set
    // it in their config (key present), honour that value; otherwise fall back
    // to the built-in catalog default so new reasoning models work out of the
    // box without requiring every user to configure it.
    const contextWindow = resolvePreferredTokenLimit({
      explicitPresent: "contextWindow" in explicitModel,
      explicitValue: explicitModel.contextWindow,
      implicitValue: implicitModel.contextWindow,
    });
    const maxTokens = resolvePreferredTokenLimit({
      explicitPresent: "maxTokens" in explicitModel,
      explicitValue: explicitModel.maxTokens,
      implicitValue: implicitModel.maxTokens,
    });

    return {
      ...explicitModel,
      input: implicitModel.input,
      reasoning: "reasoning" in explicitModel ? explicitModel.reasoning : implicitModel.reasoning,
      ...(contextWindow === undefined ? {} : { contextWindow }),
      ...(maxTokens === undefined ? {} : { maxTokens }),
    };
  });

  for (const implicitModel of implicitModels) {
    const id = getId(implicitModel);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    mergedModels.push(implicitModel);
  }

  return {
    ...implicit,
    ...explicit,
    models: mergedModels,
  };
}

function mergeProviders(params: {
  implicit?: Record<string, ProviderConfig> | null;
  explicit?: Record<string, ProviderConfig> | null;
}): Record<string, ProviderConfig> {
  const out: Record<string, ProviderConfig> = params.implicit ? { ...params.implicit } : {};
  for (const [key, explicit] of Object.entries(params.explicit ?? {})) {
    const providerKey = key.trim();
    if (!providerKey) {
      continue;
    }
    const implicit = out[providerKey];
    out[providerKey] = implicit ? mergeProviderModels(implicit, explicit) : explicit;
  }
  return out;
}

async function resolveProvidersForModelsJson(params: {
  cfg: OpenClawConfig;
  agentDir: string;
}): Promise<Record<string, ProviderConfig>> {
  const { cfg, agentDir } = params;
  const explicitProviders = cfg.models?.providers ?? {};
  const implicitProviders = await resolveImplicitProviders({ agentDir, explicitProviders });
  const providers: Record<string, ProviderConfig> = mergeProviders({
    implicit: implicitProviders,
    explicit: explicitProviders,
  });

  const implicitBedrock = await resolveImplicitBedrockProvider({ agentDir, config: cfg });
  if (implicitBedrock) {
    const existing = providers[BEDROCK_PROVIDER_ID];
    providers[BEDROCK_PROVIDER_ID] = existing
      ? mergeProviderModels(implicitBedrock, existing)
      : implicitBedrock;
  }

  const implicitCopilot = await resolveImplicitCopilotProvider({ agentDir });
  if (implicitCopilot && !providers[COPILOT_PROVIDER_ID]) {
    providers[COPILOT_PROVIDER_ID] = implicitCopilot;
  }
  return providers;
}

type ExistingProviderEntry = NonNullable<ModelsConfig["providers"]>[string] & {
  apiKey?: string;
  baseUrl?: string;
};

/**
 * Decide whether the previous (literal) credential of a provider has to be
 * carried over to the new provider entry.
 *
 * Only a literal apiKey is carried over: env-var references and markers are
 * already the "cleaner" form and must win over a stale literal.
 */
function resolvePreservedApiKey(params: {
  key: string;
  newEntry: ProviderConfig;
  existing: ExistingProviderEntry;
  secretRefManagedProviders: ReadonlySet<string>;
}): string | undefined {
  const newEntryApiKey = (params.newEntry as { apiKey?: unknown }).apiKey;
  const newEntryHasEnvRefApiKey =
    typeof newEntryApiKey === "string" &&
    newEntryApiKey.trim().length > 0 &&
    isNonSecretApiKeyMarker(newEntryApiKey, { includeEnvVarName: true });
  if (params.secretRefManagedProviders.has(params.key) || newEntryHasEnvRefApiKey) {
    return undefined;
  }
  const existingApiKey = params.existing.apiKey;
  if (
    typeof existingApiKey !== "string" ||
    !existingApiKey ||
    isNonSecretApiKeyMarker(existingApiKey, { includeEnvVarName: false })
  ) {
    return undefined;
  }
  return existingApiKey;
}

function mergeWithExistingProviderSecrets(params: {
  nextProviders: Record<string, ProviderConfig>;
  existingProviders: Record<string, NonNullable<ModelsConfig["providers"]>[string]>;
  secretRefManagedProviders: ReadonlySet<string>;
  explicitBaseUrlProviders: ReadonlySet<string>;
}): Record<string, ProviderConfig> {
  const { nextProviders, existingProviders, secretRefManagedProviders, explicitBaseUrlProviders } =
    params;
  const mergedProviders: Record<string, ProviderConfig> = {};
  for (const [key, entry] of Object.entries(existingProviders)) {
    mergedProviders[key] = entry;
  }
  for (const [key, newEntry] of Object.entries(nextProviders)) {
    const existing = existingProviders[key] as ExistingProviderEntry | undefined;
    if (!existing) {
      mergedProviders[key] = newEntry;
      continue;
    }
    const preserved: Record<string, unknown> = {};
    // Only preserve the old literal apiKey when the new (normalized) entry does
    // NOT already carry a cleaner env-var-ref / marker form. Otherwise we'd
    // write the stale literal token back and defeat the env-var normalization.
    const preservedApiKey = resolvePreservedApiKey({
      key,
      newEntry,
      existing,
      secretRefManagedProviders,
    });
    if (preservedApiKey) {
      preserved.apiKey = preservedApiKey;
    }
    if (
      !explicitBaseUrlProviders.has(key) &&
      typeof existing.baseUrl === "string" &&
      existing.baseUrl
    ) {
      preserved.baseUrl = existing.baseUrl;
    }
    mergedProviders[key] = { ...newEntry, ...preserved };
  }
  return mergedProviders;
}

/**
 * Keep the credential of providers that survive a provider switch.
 *
 * In `replace` mode the previous provider set is dropped, but a provider that
 * is still configured must not silently lose the credential that is still
 * referenced. The apiKey of the *old* entry wins over a stale literal, exactly
 * like in merge mode.
 */
function preserveExistingProviderCredentials(params: {
  nextProviders: Record<string, ProviderConfig>;
  existingProviders: Record<string, NonNullable<ModelsConfig["providers"]>[string]>;
  secretRefManagedProviders: ReadonlySet<string>;
}): Record<string, ProviderConfig> {
  const preservedProviders: Record<string, ProviderConfig> = {};
  for (const [key, newEntry] of Object.entries(params.nextProviders)) {
    const existing = params.existingProviders[key] as ExistingProviderEntry | undefined;
    if (!existing) {
      preservedProviders[key] = newEntry;
      continue;
    }
    const preservedApiKey = resolvePreservedApiKey({
      key,
      newEntry,
      existing,
      secretRefManagedProviders: params.secretRefManagedProviders,
    });
    preservedProviders[key] = preservedApiKey ? { ...newEntry, apiKey: preservedApiKey } : newEntry;
  }
  return preservedProviders;
}

async function resolveProvidersForMode(params: {
  mode: NonNullable<ModelsConfig["mode"]>;
  providers: Record<string, ProviderConfig>;
  secretRefManagedProviders: ReadonlySet<string>;
  explicitBaseUrlProviders: ReadonlySet<string>;
  existingProviders?: Record<string, NonNullable<ModelsConfig["providers"]>[string]> | null;
}): Promise<Record<string, ProviderConfig>> {
  if (params.mode !== "merge") {
    if (!params.existingProviders) {
      return params.providers;
    }
    return preserveExistingProviderCredentials({
      nextProviders: params.providers,
      existingProviders: params.existingProviders,
      secretRefManagedProviders: params.secretRefManagedProviders,
    });
  }
  if (!params.existingProviders) {
    return params.providers;
  }
  return mergeWithExistingProviderSecrets({
    nextProviders: params.providers,
    existingProviders: params.existingProviders,
    secretRefManagedProviders: params.secretRefManagedProviders,
    explicitBaseUrlProviders: params.explicitBaseUrlProviders,
  });
}

async function readRawFile(pathname: string): Promise<string> {
  try {
    return await fs.readFile(pathname, "utf8");
  } catch {
    return "";
  }
}

async function ensureModelsFileMode(pathname: string): Promise<void> {
  await fs.chmod(pathname, 0o600).catch(() => {
    // best-effort
  });
}

function resolveModelsConfigInput(config?: OpenClawConfig): OpenClawConfig {
  const runtimeSource = getRuntimeConfigSourceSnapshot();
  if (!runtimeSource) {
    return config ?? loadConfig();
  }
  if (!config) {
    return runtimeSource;
  }
  const runtimeResolved = getRuntimeConfigSnapshot();
  if (runtimeResolved && config === runtimeResolved) {
    return runtimeSource;
  }
  return config;
}

async function withModelsJsonWriteLock<T>(targetPath: string, run: () => Promise<T>): Promise<T> {
  const prior = MODELS_JSON_WRITE_LOCKS.get(targetPath) ?? Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = prior.then(() => gate);
  MODELS_JSON_WRITE_LOCKS.set(targetPath, pending);
  try {
    await prior;
    return await run();
  } finally {
    release();
    if (MODELS_JSON_WRITE_LOCKS.get(targetPath) === pending) {
      MODELS_JSON_WRITE_LOCKS.delete(targetPath);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Backups (ccswitch-inspired)                                                 */
/* -------------------------------------------------------------------------- */

function redactProviderEntryForBackup(entry: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...entry };
  const apiKey = out.apiKey;
  if (
    typeof apiKey === "string" &&
    apiKey.trim() &&
    !isNonSecretApiKeyMarker(apiKey, { includeEnvVarName: true })
  ) {
    // A literal credential must never be persisted in a backup file.
    out.apiKey = REDACTED_SECRET_MARKER;
  }
  const headers = out.headers;
  if (isRecord(headers)) {
    const nextHeaders: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(headers)) {
      nextHeaders[name] =
        typeof value === "string" && value.trim() && !isSecretRefHeaderValueMarker(value)
          ? REDACTED_SECRET_MARKER
          : value;
    }
    out.headers = nextHeaders;
  }
  return out;
}

/**
 * Build the backup payload of a `models.json` file.
 *
 * Credential *references* (env var names, markers) are kept as-is so the
 * backup stays restorable; literal secrets are replaced by a redaction
 * marker. Returns `undefined` when the file cannot be parsed (an unparsable
 * file is not backed up rather than copied verbatim).
 */
export function buildModelsJsonBackupContent(raw: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) {
    return undefined;
  }
  const providers = isRecord(parsed.providers) ? parsed.providers : undefined;
  if (!providers) {
    return `${JSON.stringify(parsed, null, 2)}\n`;
  }
  const nextProviders: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(providers)) {
    nextProviders[key] = isRecord(value) ? redactProviderEntryForBackup(value) : value;
  }
  return `${JSON.stringify({ ...parsed, providers: nextProviders }, null, 2)}\n`;
}

/**
 * Rotate the backup ring: `models.json.bak` becomes `models.json.bak.1`, the
 * previous `.bak.N` entries shift up and the oldest one is dropped.
 */
async function rotateModelsJsonBackups(targetPath: string): Promise<void> {
  const backupBase = `${targetPath}.bak`;
  const maxIndex = MODELS_JSON_BACKUP_COUNT - 1;
  await fs.unlink(`${backupBase}.${maxIndex}`).catch(() => {
    // best-effort
  });
  for (let index = maxIndex - 1; index >= 1; index -= 1) {
    await fs.rename(`${backupBase}.${index}`, `${backupBase}.${index + 1}`).catch(() => {
      // best-effort
    });
  }
  await fs.rename(backupBase, `${backupBase}.1`).catch(() => {
    // best-effort
  });
}

/**
 * Write a backup of the current `models.json` before it is overwritten.
 *
 * The backup holds the *previous* provider set (redacted), so a provider
 * switch can always be rolled back. Returns the backup path, or `undefined`
 * when there was nothing to back up.
 */
export async function writeModelsJsonBackup(params: {
  targetPath: string;
  content: string;
}): Promise<string | undefined> {
  if (!params.content.trim()) {
    return undefined;
  }
  const backupContent = buildModelsJsonBackupContent(params.content);
  if (backupContent === undefined) {
    log.warn("skipping models.json backup: existing file is not valid JSON");
    return undefined;
  }
  await rotateModelsJsonBackups(params.targetPath);
  const backupPath = `${params.targetPath}.bak`;
  await fs.writeFile(backupPath, backupContent, { mode: 0o600 });
  await fs.chmod(backupPath, 0o600).catch(() => {
    // best-effort
  });
  return backupPath;
}

/* -------------------------------------------------------------------------- */
/* Provider switch pre-flight                                                   */
/* -------------------------------------------------------------------------- */

/** Options for the provider pre-flight check. */
export type ProviderPreflightOptions = {
  /** Force the pre-flight on/off. Defaults to off in test environments. */
  enabled?: boolean;
  /** Injectable fetch implementation (tests). */
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** Timeout of the reachability probe. */
  timeoutMs?: number;
};

/** Outcome of a single provider pre-flight. */
export type ProviderPreflightResult = {
  provider: string;
  ok: boolean;
  reason?: string;
};

function isPreflightEnabledByDefault(): boolean {
  const flag = process.env[PROVIDER_PREFLIGHT_ENV]?.trim().toLowerCase();
  if (flag === "0" || flag === "off" || flag === "false" || flag === "no") {
    return false;
  }
  if (flag === "1" || flag === "on" || flag === "true" || flag === "yes") {
    return true;
  }
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return false;
  }
  return true;
}

/**
 * Check that a credential is available for a provider.
 *
 * Only the *presence* of a credential is verified — never its value. The
 * credential itself is never logged.
 */
export function checkProviderCredentialPresence(params: {
  provider: string;
  entry: ProviderConfig;
}): { present: boolean; reason?: string } {
  const entry = params.entry;
  if (entry.auth === "aws-sdk") {
    return resolveAwsSdkEnvVarName()
      ? { present: true }
      : { present: false, reason: "no AWS credentials found in the environment" };
  }

  const apiKey = entry.apiKey;
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    return { present: false, reason: "no credential configured" };
  }

  const trimmed = apiKey.trim();
  if (!isNonSecretApiKeyMarker(trimmed, { includeEnvVarName: true })) {
    // A literal credential is present by definition.
    return { present: true };
  }
  if (!ENV_VAR_NAME_RE.test(trimmed)) {
    // OAuth / keychain / local markers are managed outside models.json.
    return { present: true };
  }
  if (process.env[trimmed]?.trim()) {
    return { present: true };
  }
  return {
    present: false,
    reason: `credential environment variable ${trimmed} is not set`,
  };
}

/** Probe whether a provider endpoint answers. */
export async function probeProviderEndpoint(params: {
  baseUrl: string;
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  timeoutMs?: number;
}): Promise<{ ok: boolean; reason?: string }> {
  const url = params.baseUrl.trim();
  if (!url) {
    return { ok: false, reason: "no baseUrl configured" };
  }
  try {
    const { response, release } = await fetchWithSsrFGuard({
      url,
      init: { method: "GET" },
      timeoutMs: params.timeoutMs ?? PROVIDER_PREFLIGHT_TIMEOUT_MS,
      ...(params.fetchImpl ? { fetchImpl: params.fetchImpl } : {}),
      // Provider endpoints are operator configured and may legitimately point
      // at a private/self-hosted address.
      policy: { allowPrivateNetwork: true },
      auditContext: "provider-preflight",
    });
    try {
      // Any HTTP status means the endpoint answered.
      void response.body?.cancel();
      return { ok: true };
    } finally {
      await release();
    }
  } catch (error) {
    return { ok: false, reason: `endpoint unreachable: ${String(error)}` };
  }
}

/** Run the credential + reachability pre-flight for a single provider. */
export async function runProviderPreflight(params: {
  provider: string;
  entry: ProviderConfig;
  options?: ProviderPreflightOptions;
}): Promise<ProviderPreflightResult> {
  const credential = checkProviderCredentialPresence({
    provider: params.provider,
    entry: params.entry,
  });
  if (!credential.present) {
    return { provider: params.provider, ok: false, reason: credential.reason };
  }
  const endpoint = await probeProviderEndpoint({
    baseUrl: params.entry.baseUrl ?? "",
    ...(params.options?.fetchImpl ? { fetchImpl: params.options.fetchImpl } : {}),
    ...(params.options?.timeoutMs ? { timeoutMs: params.options.timeoutMs } : {}),
  });
  if (!endpoint.ok) {
    return { provider: params.provider, ok: false, reason: endpoint.reason };
  }
  return { provider: params.provider, ok: true };
}

type ProviderSetChanges = {
  added: string[];
  removed: string[];
  changed: string[];
};

/** Compare the provider set of the existing file with the new one. */
export function detectProviderSetChanges(params: {
  existing?: Record<string, ProviderConfig> | null;
  next: Record<string, ProviderConfig>;
}): ProviderSetChanges {
  const existing = params.existing ?? {};
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const [key, entry] of Object.entries(params.next)) {
    const previous = existing[key];
    if (!previous) {
      added.push(key);
      continue;
    }
    if ((previous.baseUrl ?? "").trim() !== (entry.baseUrl ?? "").trim()) {
      changed.push(key);
    }
  }
  for (const key of Object.keys(existing)) {
    if (!params.next[key]) {
      removed.push(key);
    }
  }
  return { added, removed, changed };
}

function readExistingProviders(raw: string): Record<string, ProviderConfig> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.providers)) {
      return null;
    }
    return parsed.providers as Record<string, ProviderConfig>;
  } catch {
    return null;
  }
}

function describeProviderSwitch(changes: ProviderSetChanges): string | undefined {
  if (changes.added.length === 0 && changes.removed.length === 0 && changes.changed.length === 0) {
    return undefined;
  }
  if (changes.added.length === 1 && changes.removed.length === 1) {
    return `provider switched: ${changes.removed[0]} → ${changes.added[0]}`;
  }
  const parts: string[] = [];
  if (changes.added.length > 0) {
    parts.push(`added=[${changes.added.join(", ")}]`);
  }
  if (changes.removed.length > 0) {
    parts.push(`removed=[${changes.removed.join(", ")}]`);
  }
  if (changes.changed.length > 0) {
    parts.push(`changed=[${changes.changed.join(", ")}]`);
  }
  return `provider set changed: ${parts.join(" ")}`;
}

/**
 * Run the pre-flight for every provider that is new or whose endpoint
 * changed. Returns the providers that failed the check.
 */
async function runPreflightForSwitchedProviders(params: {
  providers: Record<string, ProviderConfig>;
  changes: ProviderSetChanges;
  options?: ProviderPreflightOptions;
}): Promise<ProviderPreflightResult[]> {
  const failures: ProviderPreflightResult[] = [];
  const targets = [...params.changes.added, ...params.changes.changed];
  for (const provider of targets) {
    const entry = params.providers[provider];
    if (!entry) {
      continue;
    }
    const result = await runProviderPreflight({
      provider,
      entry,
      ...(params.options ? { options: params.options } : {}),
    });
    if (!result.ok) {
      failures.push(result);
    }
  }
  return failures;
}

export async function ensureOpenClawModelsJson(
  config?: OpenClawConfig,
  agentDirOverride?: string,
  options?: { preflight?: ProviderPreflightOptions },
): Promise<{ agentDir: string; wrote: boolean }> {
  const cfg = resolveModelsConfigInput(config);
  const agentDir = agentDirOverride?.trim() ? agentDirOverride.trim() : resolveOpenClawAgentDir();
  const targetPath = path.join(agentDir, "models.json");

  return await withModelsJsonWriteLock(targetPath, async () => {
    // Ensure config env vars (e.g. AWS_PROFILE, AWS_ACCESS_KEY_ID) are
    // available in process.env before implicit provider discovery. Some
    // callers (agent runner, tools) pass config objects that haven't gone
    // through the full loadConfig() pipeline which applies these.
    applyConfigEnvVars(cfg);

    const providers = await resolveProvidersForModelsJson({ cfg, agentDir });

    if (Object.keys(providers).length === 0) {
      return { agentDir, wrote: false };
    }

    const mode = cfg.models?.mode ?? DEFAULT_MODE;
    const secretRefManagedProviders = new Set<string>();
    const explicitBaseUrlProviders = new Set(
      Object.entries(cfg.models?.providers ?? {})
        .map(([key, provider]) => [key.trim(), provider] as const)
        .filter(
          ([key, provider]) =>
            Boolean(key) && typeof provider?.baseUrl === "string" && provider.baseUrl.trim(),
        )
        .map(([key]) => key),
    );

    const normalizedProviders =
      normalizeProviders({
        providers,
        agentDir,
        secretDefaults: cfg.secrets?.defaults,
        secretRefManagedProviders,
      }) ?? providers;
    const existingRaw = await readRawFile(targetPath);
    const existingProviders = readExistingProviders(existingRaw);
    const mergedProviders = await resolveProvidersForMode({
      mode,
      providers: normalizedProviders,
      secretRefManagedProviders,
      explicitBaseUrlProviders,
      existingProviders,
    });

    let next = `${JSON.stringify({ providers: mergedProviders }, null, 2)}\n`;

    if (existingRaw === next) {
      await ensureModelsFileMode(targetPath);
      return { agentDir, wrote: false };
    }

    const preflightEnabled = options?.preflight?.enabled ?? isPreflightEnabledByDefault();
    if (preflightEnabled) {
      const changes = detectProviderSetChanges({
        existing: existingProviders,
        next: mergedProviders,
      });
      const failures = await runPreflightForSwitchedProviders({
        providers: mergedProviders,
        changes,
        options: options?.preflight,
      });
      if (failures.length > 0) {
        for (const failure of failures) {
          log.warn(`pre-flight failed: ${failure.provider}: ${failure.reason ?? "unknown reason"}`);
        }
        if (mode !== "merge") {
          // The previous provider set would be dropped: keep it.
          log.warn("pre-flight failed: keeping the previous models.json configuration");
          return { agentDir, wrote: false };
        }
        // Merge mode keeps the previous entry of a provider that fails the
        // pre-flight: restore it instead of the new one.
        for (const failure of failures) {
          const previous = existingProviders?.[failure.provider];
          if (previous) {
            mergedProviders[failure.provider] = previous;
          } else {
            delete mergedProviders[failure.provider];
          }
        }
        next = `${JSON.stringify({ providers: mergedProviders }, null, 2)}\n`;
        if (existingRaw === next) {
          await ensureModelsFileMode(targetPath);
          return { agentDir, wrote: false };
        }
        if (Object.keys(mergedProviders).length === 0) {
          // Nothing survived the pre-flight: keep the previous state as-is.
          return { agentDir, wrote: false };
        }
      }
    }

    const changes = detectProviderSetChanges({
      existing: existingProviders,
      next: mergedProviders,
    });
    const switchDescription = describeProviderSwitch(changes);
    if (switchDescription) {
      log.info(switchDescription);
    }

    await fs.mkdir(agentDir, { recursive: true, mode: 0o700 });
    const backupPath = await writeModelsJsonBackup({ targetPath, content: existingRaw });
    if (backupPath) {
      log.info(`backup written: ${backupPath}`);
    }
    await fs.writeFile(targetPath, next, { mode: 0o600 });
    await ensureModelsFileMode(targetPath);
    // Invalidate the model catalog cache so newly written providers/models are
    // visible without a process restart. Dynamic import avoids a static import
    // cycle (model-catalog imports this module).
    try {
      const { invalidateModelCatalogCache } = await import("./model-catalog.js");
      invalidateModelCatalogCache();
    } catch {
      // best-effort — cache will refresh on next natural expiry / restart
    }
    return { agentDir, wrote: true };
  });
}
