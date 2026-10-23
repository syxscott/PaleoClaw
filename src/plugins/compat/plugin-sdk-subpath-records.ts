import type { PluginCompatRecord } from "./types.js";

type SeedFields = "code" | "owner" | "removalGate" | "replacement";
type PluginSdkSubpathSeed = Pick<PluginCompatRecord, SeedFields> &
  Record<"subpath", string> &
  Partial<Pick<PluginCompatRecord, "status" | "removeAfter">>;

const PLUGIN_SDK_SUBPATH_SEEDS = [
  {
    code: "plugin-sdk-channel-streaming-subpath",
    subpath: "channel-streaming",
    status: "removed",
    owner: "channel",
    replacement: "`paleoclaw/plugin-sdk/channel-outbound`",
  },
  {
    code: "plugin-sdk-config-runtime-subpath",
    subpath: "config-runtime",
    status: "removed",
    removeAfter: "2026-09-30",
    owner: "config",
    replacement:
      "`api.pluginConfig`, `paleoclaw/plugin-sdk/config-mutation`, `paleoclaw/plugin-sdk/runtime-config-snapshot`, and `paleoclaw/plugin-sdk/config-contracts`",
  },
  {
    code: "plugin-sdk-inbound-reply-dispatch-subpath",
    subpath: "inbound-reply-dispatch",
    owner: "channel",
    removalGate: "stable-deprecation-period",
    replacement: "`paleoclaw/plugin-sdk/channel-inbound` and `paleoclaw/plugin-sdk/channel-outbound`",
  },
  {
    code: "plugin-sdk-channel-reply-pipeline-subpath",
    subpath: "channel-reply-pipeline",
    status: "removed",
    removeAfter: "2026-09-30",
    owner: "channel",
    replacement: "`paleoclaw/plugin-sdk/channel-outbound`",
  },
  {
    code: "plugin-sdk-infra-runtime-subpath",
    subpath: "infra-runtime",
    status: "removed",
    removeAfter: "2026-09-30",
    owner: "sdk",
    replacement:
      "focused typed subpaths including `paleoclaw/plugin-sdk/system-event-runtime`, `paleoclaw/plugin-sdk/error-runtime`, `paleoclaw/plugin-sdk/approval-runtime`, and `paleoclaw/plugin-sdk/ssrf-runtime`; use injected runtime APIs for host operations without a public subpath",
  },
  {
    code: "plugin-sdk-text-runtime-subpath",
    subpath: "text-runtime",
    status: "removed",
    owner: "sdk",
    replacement:
      "`paleoclaw/plugin-sdk/logging-core`, `paleoclaw/plugin-sdk/text-chunking`, `paleoclaw/plugin-sdk/text-utility-runtime`, and `paleoclaw/plugin-sdk/string-coerce-runtime`",
  },
  {
    code: "plugin-sdk-channel-secret-runtime-subpath",
    subpath: "channel-secret-runtime",
    status: "removed",
    owner: "channel",
    replacement:
      "`paleoclaw/plugin-sdk/channel-secret-basic-runtime` and `paleoclaw/plugin-sdk/channel-secret-tts-runtime`",
  },
  {
    code: "plugin-sdk-agent-config-primitives-subpath",
    subpath: "agent-config-primitives",
    status: "removed",
    owner: "config",
    replacement: "`paleoclaw/plugin-sdk/channel-config-schema`",
  },
  {
    code: "plugin-sdk-matrix-subpath",
    subpath: "matrix",
    status: "removed",
    owner: "channel",
    replacement: "`paleoclaw/plugin-sdk/run-command`",
  },
  {
    code: "plugin-sdk-channel-logging-subpath",
    subpath: "channel-logging",
    status: "removed",
    owner: "channel",
    replacement: "`paleoclaw/plugin-sdk/channel-inbound` and `paleoclaw/plugin-sdk/channel-outbound`",
  },
  {
    code: "plugin-sdk-channel-lifecycle-subpath",
    subpath: "channel-lifecycle",
    status: "removed",
    removeAfter: "2026-09-30",
    owner: "channel",
    replacement: "`paleoclaw/plugin-sdk/channel-outbound`",
  },
  {
    code: "plugin-sdk-channel-message-subpath",
    subpath: "channel-message",
    status: "removed",
    removeAfter: "2026-09-30",
    owner: "channel",
    replacement: "`paleoclaw/plugin-sdk/channel-outbound` and `paleoclaw/plugin-sdk/channel-inbound`",
  },
  {
    code: "plugin-sdk-command-auth-subpath",
    subpath: "command-auth",
    status: "removed",
    removeAfter: "2026-10-01",
    owner: "sdk",
    replacement:
      "`paleoclaw/plugin-sdk/channel-ingress-runtime` for sender authorization; matching named exports from `paleoclaw/plugin-sdk/command-auth-native`, `paleoclaw/plugin-sdk/command-status`, `paleoclaw/plugin-sdk/models-provider-runtime`, and `paleoclaw/plugin-sdk/channel-inbound`; adapt legacy authorization types to the ingress contract",
  },
  {
    code: "plugin-sdk-discord-subpath",
    subpath: "discord",
    status: "removed",
    removeAfter: "2026-10-01",
    owner: "channel",
    replacement:
      "matching named exports from `paleoclaw/plugin-sdk/channel-contract`, `paleoclaw/plugin-sdk/channel-core`, `paleoclaw/plugin-sdk/channel-plugin-common`, `paleoclaw/plugin-sdk/channel-status`, or `paleoclaw/plugin-sdk/config-contracts`; external plugins use generic channel contracts and the injected runtime for channel-owned behavior",
  },
  {
    code: "plugin-sdk-telegram-account-subpath",
    subpath: "telegram-account",
    status: "removed",
    removeAfter: "2026-10-01",
    owner: "channel",
    replacement:
      "generic channel contracts and injected runtime helpers for external plugins; the Telegram plugin's `api.ts` for repository consumers",
  },
  {
    code: "plugin-sdk-group-access-subpath",
    subpath: "group-access",
    status: "removed",
    owner: "channel",
    replacement: "`paleoclaw/plugin-sdk/channel-ingress-runtime`",
  },
  {
    code: "plugin-sdk-zod-subpath",
    subpath: "zod",
    status: "removed",
    owner: "sdk",
    replacement: "the direct `zod` package import",
  },
] as const satisfies readonly PluginSdkSubpathSeed[];

function buildPluginSdkSubpathRecord(seed: (typeof PLUGIN_SDK_SUBPATH_SEEDS)[number]) {
  const shared = {
    code: seed.code,
    owner: seed.owner,
    replacement: seed.replacement,
    docsPath: "/plugins/sdk-migration",
    surfaces: [`paleoclaw/plugin-sdk/${seed.subpath}`],
  };
  if ("status" in seed && seed.status === "removed") {
    return {
      ...shared,
      status: seed.status,
      removeAfter: "removeAfter" in seed ? seed.removeAfter : undefined,
      diagnostics: ["plugin SDK compatibility registry and migration guide"],
    } satisfies PluginCompatRecord;
  }

  return {
    ...shared,
    status: "status" in seed ? seed.status : "deprecated",
    deprecated: "2026-07-06",
    warningStarts: "2026-07-06",
    removalGate: "removalGate" in seed ? seed.removalGate : undefined,
    diagnostics: [
      "repository deprecated API usage guard for core and bundled plugins; no external runtime import warning",
    ],
  } satisfies PluginCompatRecord;
}

export const PLUGIN_SDK_SUBPATH_RECORDS = PLUGIN_SDK_SUBPATH_SEEDS.map(
  buildPluginSdkSubpathRecord,
) satisfies readonly PluginCompatRecord[];

const BUNDLED_ONLY_PUBLIC_PLUGIN_SDK_SUBPATH_SEEDS = [
  {
    subpath: "media-understanding",
    status: "removal-pending",
    removeAfter: "2026-09-30",
    replacement:
      "`api.registerMediaUnderstandingProvider(...)` with provider-owned request helpers and types from `paleoclaw/plugin-sdk/plugin-entry`; retain the public subpath through the 2026-09-30 window while official plugin consumers migrate",
    docsPath: "/plugins/architecture",
  },
  {
    subpath: "memory-host-core",
    status: "removal-pending",
    removeAfter: "2026-09-30",
    replacement:
      "host-prepared memory prompts via `paleoclaw/plugin-sdk/core` and memory capability registration through the injected plugin API; retain the facade through the 2026-09-30 window and until a focused public-artifact read seam exists",
    docsPath: "/plugins/architecture-internals#context-engine-plugins",
  },
  {
    subpath: "plugin-config-runtime",
    status: "removal-pending",
    removeAfter: "2026-12-01",
    replacement:
      "`api.pluginConfig`, runtime tool context config, and focused `config-contracts`, `runtime-config-snapshot`, or `config-mutation` subpaths; retain the public subpath through the 2026-12-01 window while official plugin consumers migrate",
    docsPath: "/plugins/sdk-runtime",
  },
  {
    subpath: "tool-plugin",
    status: "deprecated",
    replacement:
      "retain the public subpath until plugin authoring has a nonexecuting static metadata replacement for `defineToolPlugin`; `getToolPluginMetadata` currently reads metadata only from an already-executed entry",
    docsPath: "/plugins/tool-plugins",
  },
] as const;

function buildPublicSdkSubpathRecord({
  subpath,
  ...compat
}: (typeof BUNDLED_ONLY_PUBLIC_PLUGIN_SDK_SUBPATH_SEEDS)[number]) {
  return {
    code: `plugin-sdk-${subpath}-public-demotion` as const,
    owner: "sdk" as const,
    deprecated: "2026-07-15",
    warningStarts: "2026-07-15",
    ...compat,
    surfaces: [`paleoclaw/plugin-sdk/${subpath}`],
    diagnostics: ["registry-backed public SDK demotion window; no external runtime import warning"],
  } satisfies PluginCompatRecord;
}

export const BUNDLED_ONLY_PUBLIC_PLUGIN_SDK_SUBPATH_RECORDS =
  BUNDLED_ONLY_PUBLIC_PLUGIN_SDK_SUBPATH_SEEDS.map(buildPublicSdkSubpathRecord);
