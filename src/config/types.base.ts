import type { z } from "zod";
import type {
  ChannelPreviewStreamingConfigSchema,
  ChannelStreamingProgressSchema,
  ChannelThreadBindingsSchema,
  UnifiedStreamingModeSchema,
} from "./zod-schema.channel-messaging-common.js";
import type {
  BlockStreamingChunkSchema,
  BlockStreamingCoalesceSchema,
  ChannelDeliveryStreamingConfigSchema,
  ChannelStreamingBlockSchema,
  ContextVisibilityModeSchema,
  DmPolicySchema,
  GroupPolicySchema,
  HumanDelaySchema,
  IdentitySchema,
  MarkdownConfigSchema,
  ReplyToModeSchema,
  TextChunkModeSchema,
  TypingModeSchema,
} from "./zod-schema.core.js";
import type { DiagnosticsConfigSchema, LoggingConfigSchema } from "./zod-schema.logging.js";
import type { SessionSchema } from "./zod-schema.session-config.js";

/** Typing indicator timing policy shared by channel configs. */
export type TypingMode = z.input<typeof TypingModeSchema>;
/** Session-key ownership model for inbound messages. */
export type SessionScope = NonNullable<SessionConfig["scope"]>;
/** DM session-key granularity across peers, channels, and accounts. */
export type DmScope = NonNullable<SessionConfig["dmScope"]>;
export type GroupScope = NonNullable<SessionConfig["groupScope"]>;
/** Which source messages outbound replies should thread or quote against. */
export type ReplyToMode = z.input<typeof ReplyToModeSchema>;
/** Group-chat admission policy for channels with allowlists. */
export type GroupPolicy = z.input<typeof GroupPolicySchema>;
/** Direct-message admission policy for channels with pairing/allowlists. */
export type DmPolicy = z.input<typeof DmPolicySchema>;
/** How much non-allowlisted context is visible to an agent. */
export type ContextVisibilityMode = z.input<typeof ContextVisibilityModeSchema>;
/** Text splitting strategy for outbound channel delivery. */
export type TextChunkMode = z.input<typeof TextChunkModeSchema>;
/** Preview/progress delivery mode while an agent response is still streaming. */
export type StreamingMode = z.input<typeof UnifiedStreamingModeSchema>;
/** How command text is represented in streaming progress previews. */
export type ChannelStreamingCommandTextMode = NonNullable<
  z.input<typeof ChannelStreamingProgressSchema>["commandText"]
>;

export type BlockStreamingCoalesceConfig = z.input<typeof BlockStreamingCoalesceSchema>;
export type BlockStreamingChunkConfig = z.input<typeof BlockStreamingChunkSchema>;
export type ChannelStreamingProgressConfig = z.input<typeof ChannelStreamingProgressSchema>;
export type ChannelStreamingBlockConfig = z.input<typeof ChannelStreamingBlockSchema>;

type SchemaChannelStreamingConfig = z.input<typeof ChannelPreviewStreamingConfigSchema>;

export type ChannelStreamingConfig<
  TProgress extends ChannelStreamingProgressConfig = ChannelStreamingProgressConfig,
> = Omit<SchemaChannelStreamingConfig, "progress"> & {
  /** Prefer a channel's native streaming transport over its portable draft path. */
  nativeTransport?: boolean;
  progress?: TProgress;
};

export type ChannelDeliveryStreamingConfig = z.input<typeof ChannelDeliveryStreamingConfigSchema>;

/** Streaming subset used by channels that render visible preview/progress replies. */
export type ChannelPreviewStreamingConfig = SchemaChannelStreamingConfig;

export type MarkdownConfig = NonNullable<z.input<typeof MarkdownConfigSchema>>;
export type MarkdownTableMode = NonNullable<MarkdownConfig["tables"]>;
export type HumanDelayConfig = z.input<typeof HumanDelaySchema>;

type SessionSchemaInput = NonNullable<z.input<typeof SessionSchema>>;

export type SessionResetConfig = NonNullable<SessionSchemaInput["reset"]>;
export type SessionResetMode = NonNullable<SessionResetConfig["mode"]>;

export type SessionThreadBindingsConfig = z.input<typeof ChannelThreadBindingsSchema>;

export type SessionConfig = SessionSchemaInput;

export type SessionMaintenanceConfig = NonNullable<SessionSchemaInput["maintenance"]>;
export type SessionMaintenanceMode = NonNullable<SessionMaintenanceConfig["mode"]>;

// Provider docking: allowlists keyed by provider id (and internal "webchat").
export type AgentElevatedAllowFromConfig = Partial<Record<string, Array<string | number>>>;

export type IdentityConfig = NonNullable<z.input<typeof IdentitySchema>>;

export type LoggingConfig = NonNullable<z.input<typeof LoggingConfigSchema>>;

/**
 * Idle/stall watchdog for the embedded agent stream.
 *
 * Off by default. When enabled, an idle stream (no event at all) is aborted
 * and retried in non-streaming mode, while a stalled stream (a long gap
 * between two events) is only logged — the model may simply be thinking.
 */
export type DiagnosticsStreamWatchdogConfig = {
  enabled?: boolean;
  /** No event at all for this long → abort the stream and fall back. */
  idleTimeoutMs?: number;
  /** Gap between two events longer than this → log only, never interrupt. */
  stallTimeoutMs?: number;
  /** "fresh" for a new session, "resume" for a continued one. */
  profile?: "fresh" | "resume";
};

export type DiagnosticsConfig = NonNullable<z.input<typeof DiagnosticsConfigSchema>> & {
  /** PaleoClaw-only watchdog knobs; the upstream diagnostics schema omits them. */
  streamWatchdog?: DiagnosticsStreamWatchdogConfig;
};

export type AuditConfig = NonNullable<LoggingConfig["audit"]>;

// ---------------------------------------------------------------------------
// PaleoClaw-only types that the upstream Zod-derived surface does not carry.
// ---------------------------------------------------------------------------

export type ReplyMode = "text" | "command";

export type OutboundRetryConfig = {
  /** Max retry attempts for outbound requests (default: 3). */
  attempts?: number;
  /** Minimum retry delay in ms (default: 300-500ms depending on provider). */
  minDelayMs?: number;
  /** Maximum retry delay cap in ms (default: 30000). */
  maxDelayMs?: number;
  /** Jitter factor (0-1) applied to delays (default: 0.1). */
  jitter?: number;
};

export type WebReconnectConfig = {
  initialMs?: number;
  maxMs?: number;
  factor?: number;
  jitter?: number;
  maxAttempts?: number; // 0 = unlimited
};

export type WebConfig = {
  /** If false, do not start the WhatsApp web provider. Default: true. */
  enabled?: boolean;
  heartbeatSeconds?: number;
  reconnect?: WebReconnectConfig;
};

export type SessionSendPolicyAction = "allow" | "deny";
export type SessionSendPolicyMatch = {
  channel?: string;
  chatType?: "direct" | "group" | "channel";
  /**
   * Session key prefix match.
   * Note: some consumers match against a normalized key (for example, stripping `agent:<id>:`).
   */
  keyPrefix?: string;
  /** Optional raw session-key prefix match for consumers that normalize session keys. */
  rawKeyPrefix?: string;
};
export type SessionSendPolicyRule = {
  action: SessionSendPolicyAction;
  match?: SessionSendPolicyMatch;
};
export type SessionSendPolicyConfig = {
  default?: SessionSendPolicyAction;
  rules?: SessionSendPolicyRule[];
};
