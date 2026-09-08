import { parseAgentSessionKey } from "../../../../src/sessions/session-key-utils.js";
import { resetToolStream } from "../app-tool-stream.ts";
import { extractText } from "../chat/message-extract.ts";
import type { GatewayBrowserClient } from "../gateway.ts";
import { clearDraft, loadDraft, saveDraft } from "../lib/draft-store.ts";
import type { ChatAttachment } from "../ui-types.ts";
import { generateUUID } from "../uuid.ts";

const SILENT_REPLY_PATTERN = /^\s*NO_REPLY\s*$/;
/**
 * Partial NO_REPLY forms (e.g. a cumulative stream that jumped from "NO_REPL"
 * straight to final). Tolerated ONLY at final-commit time — mid-stream delta
 * rejection keeps the exact-match behavior so partial text still streams.
 */
const SILENT_REPLY_PARTIAL_PATTERN = /^\s*NO_?R?E?P?L?Y?\s*$/i;

function isSilentReplyStream(text: string): boolean {
  return SILENT_REPLY_PATTERN.test(text);
}

/** Final-commit variant of isSilentReplyStream: also swallows truncated prefixes. */
function isSilentReplyCommit(text: string): boolean {
  return SILENT_REPLY_PATTERN.test(text) || SILENT_REPLY_PARTIAL_PATTERN.test(text);
}
/** Client-side defense-in-depth: detect assistant messages whose text is purely NO_REPLY. */
function isAssistantSilentReply(message: unknown): boolean {
  if (!message || typeof message !== "object") {
    return false;
  }
  const entry = message as Record<string, unknown>;
  const role = typeof entry.role === "string" ? entry.role.toLowerCase() : "";
  if (role !== "assistant") {
    return false;
  }
  // entry.text takes precedence — matches gateway extractAssistantTextForSilentCheck
  if (typeof entry.text === "string") {
    return isSilentReplyStream(entry.text);
  }
  const text = extractText(message);
  return typeof text === "string" && isSilentReplyStream(text);
}

export type ChatState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  sessionKey: string;
  chatLoading: boolean;
  chatMessages: unknown[];
  chatThinkingLevel: string | null;
  chatSending: boolean;
  chatMessage: string;
  chatAttachments: ChatAttachment[];
  chatRunId: string | null;
  chatStream: string | null;
  chatStreamStartedAt: number | null;
  lastError: string | null;
  /**
   * Last send that failed at the gateway layer (see sendChatMessage). Exposed
   * so the view can offer a retry affordance; cleared on any successful send
   * or when retryLastFailedSend() succeeds. Optional because existing hosts
   * (OpenClawApp) predate this field — treat falsy as "nothing pending".
   */
  lastFailedSend?: { text: string; at: number } | null;
};

export type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
};

function maybeResetToolStream(state: ChatState) {
  const toolHost = state as ChatState & Partial<Parameters<typeof resetToolStream>[0]>;
  if (
    toolHost.toolStreamById instanceof Map &&
    Array.isArray(toolHost.toolStreamOrder) &&
    Array.isArray(toolHost.chatToolMessages) &&
    Array.isArray(toolHost.chatStreamSegments)
  ) {
    resetToolStream(toolHost as Parameters<typeof resetToolStream>[0]);
  }
}

/* ------------------------------------------------------------------ */
/*  Composer drafts (IndexedDB, see lib/draft-store.ts)                */
/* ------------------------------------------------------------------ */

const COMPOSER_DRAFT_DEBOUNCE_MS = 400;
/** Sampling interval for the draft-sync bridge (see startComposerDraftSync). */
const COMPOSER_DRAFT_SYNC_INTERVAL_MS = 300;

/** Composite key `<agentScope>|<sessionKey>` — matches lib/draft-store.ts docs. */
function composerDraftKey(state: Pick<ChatState, "sessionKey">): string {
  const agentScope = parseAgentSessionKey(state.sessionKey)?.agentId ?? "main";
  return `${agentScope}|${state.sessionKey}`;
}

const draftSaveTimers = new Map<string, number>();

function cancelScheduledDraftSave(key: string) {
  const timer = draftSaveTimers.get(key);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    draftSaveTimers.delete(key);
  }
}

/** Debounced (~400ms) draft write; empty text removes the stored draft. */
function scheduleComposerDraftSave(state: ChatState, text: string) {
  const key = composerDraftKey(state);
  cancelScheduledDraftSave(key);
  draftSaveTimers.set(
    key,
    window.setTimeout(() => {
      draftSaveTimers.delete(key);
      // The captured key/text pair is historically accurate even if the user
      // switched sessions in the meantime: the text was typed in `key`'s
      // session, so it belongs there.
      if (text.trim()) {
        void saveDraft(key, text).catch(() => undefined);
      } else {
        void clearDraft(key).catch(() => undefined);
      }
    }, COMPOSER_DRAFT_DEBOUNCE_MS),
  );
}

/**
 * Loads the persisted draft for the current session into the composer. Never
 * clobbers live typing and never throws — drafts are best-effort.
 */
export async function restoreComposerDraft(state: ChatState): Promise<void> {
  const key = composerDraftKey(state);
  try {
    const draft = await loadDraft(key);
    if (composerDraftKey(state) !== key) {
      return; // Session switched mid-load.
    }
    if (state.chatMessage.trim()) {
      return; // The user typed while the load was in flight — keep theirs.
    }
    if (draft) {
      state.chatMessage = draft;
    }
  } catch {
    // loadDraft is rejection-safe; this guard is defense in depth.
  }
}

/** Clears the persisted draft for `key` (defaults to the current session). */
function clearComposerDraft(state: ChatState, key: string = composerDraftKey(state)) {
  cancelScheduledDraftSave(key);
  void clearDraft(key).catch(() => undefined);
}

/**
 * Call from the composer's change handler to persist the draft on input.
 * View integration point: app-render.ts passes
 * `onDraftChange: (next) => (state.chatMessage = next)` to renderChat — route
 * that through this helper (or rely on startComposerDraftSync's sampler).
 */
export function handleComposerInput(state: ChatState, text: string) {
  state.chatMessage = text;
  scheduleComposerDraftSave(state, text);
}

// Draft-sync bridge: the composer input handler lives in the view layer
// (app-render.ts onDraftChange), which this controller cannot reach statically.
// A low-frequency sampler watches chatMessage for changes and schedules the
// same debounced saves, so drafts work without touching the view. WeakRefs
// keep the registry free of leaks; hosts disappear when the page does.
const draftSyncWatchers = new Set<WeakRef<ChatState>>();
const draftSyncLastSeen = new WeakMap<ChatState, string>();
let draftSyncTimer: number | null = null;

function startComposerDraftSync(state: ChatState) {
  if (draftSyncLastSeen.has(state)) {
    return;
  }
  draftSyncLastSeen.set(state, state.chatMessage);
  draftSyncWatchers.add(new WeakRef(state));
  if (draftSyncTimer !== null) {
    return;
  }
  draftSyncTimer = window.setInterval(() => {
    try {
      for (const ref of draftSyncWatchers) {
        const watched = ref.deref();
        if (!watched) {
          draftSyncWatchers.delete(ref);
          continue;
        }
        const lastSeen = draftSyncLastSeen.get(watched);
        if (watched.chatMessage === lastSeen) {
          continue;
        }
        draftSyncLastSeen.set(watched, watched.chatMessage);
        scheduleComposerDraftSave(watched, watched.chatMessage);
      }
    } catch {
      // The sampler must never throw into the interval handler.
    }
    // Every watched host is gone: stop sampling. The next startComposerDraftSync
    // registration restarts the interval lazily (see the null-timer check there).
    if (draftSyncWatchers.size === 0 && draftSyncTimer !== null) {
      window.clearInterval(draftSyncTimer);
      draftSyncTimer = null;
    }
  }, COMPOSER_DRAFT_SYNC_INTERVAL_MS);
}

export async function loadChatHistory(state: ChatState) {
  // Restore the persisted composer draft for this session (if any). Runs even
  // while disconnected — drafts are local IndexedDB, unlike chat history —
  // and covers chat init plus every session-switch path.
  startComposerDraftSync(state);
  void restoreComposerDraft(state);
  if (!state.client || !state.connected) {
    return;
  }
  // Bind this load to the session it was requested for; discard the response
  // when the user switched sessions mid-flight (mirrors restoreComposerDraft's
  // composerDraftKey guard below).
  const sessionKey = state.sessionKey;
  state.chatLoading = true;
  state.lastError = null;
  try {
    const res = await state.client.request<{ messages?: Array<unknown>; thinkingLevel?: string }>(
      "chat.history",
      {
        sessionKey,
        limit: 200,
      },
    );
    if (state.sessionKey !== sessionKey) {
      return; // Session switched mid-load — the stale history must not apply.
    }
    const messages = Array.isArray(res.messages) ? res.messages : [];
    state.chatMessages = messages.filter((message) => !isAssistantSilentReply(message));
    state.chatThinkingLevel = res.thinkingLevel ?? null;
    // Clear all streaming state — history includes tool results and text
    // inline, so keeping streaming artifacts would cause duplicates.
    maybeResetToolStream(state);
    state.chatStream = null;
    state.chatStreamStartedAt = null;
  } catch (err) {
    if (state.sessionKey !== sessionKey) {
      return; // Stale failure — don't surface it in the new session.
    }
    state.lastError = String(err);
  } finally {
    // Unconditional: chatLoading has no owner key, and leaving it stuck true
    // after a superseded load would block the next load's spinner reset.
    state.chatLoading = false;
  }
}

function dataUrlToBase64(dataUrl: string): { content: string; mimeType: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return null;
  }
  return { mimeType: match[1], content: match[2] };
}

type AssistantMessageNormalizationOptions = {
  roleRequirement: "required" | "optional";
  roleCaseSensitive?: boolean;
  requireContentArray?: boolean;
  allowTextField?: boolean;
};

function normalizeAssistantMessage(
  message: unknown,
  options: AssistantMessageNormalizationOptions,
): Record<string, unknown> | null {
  if (!message || typeof message !== "object") {
    return null;
  }
  const candidate = message as Record<string, unknown>;
  const roleValue = candidate.role;
  if (typeof roleValue === "string") {
    const role = options.roleCaseSensitive ? roleValue : roleValue.toLowerCase();
    if (role !== "assistant") {
      return null;
    }
  } else if (options.roleRequirement === "required") {
    return null;
  }

  if (options.requireContentArray) {
    return Array.isArray(candidate.content) ? candidate : null;
  }
  if (!("content" in candidate) && !(options.allowTextField && "text" in candidate)) {
    return null;
  }
  return candidate;
}

function normalizeAbortedAssistantMessage(message: unknown): Record<string, unknown> | null {
  return normalizeAssistantMessage(message, {
    roleRequirement: "required",
    roleCaseSensitive: true,
    requireContentArray: true,
  });
}

function normalizeFinalAssistantMessage(message: unknown): Record<string, unknown> | null {
  return normalizeAssistantMessage(message, {
    roleRequirement: "optional",
    allowTextField: true,
  });
}

export async function sendChatMessage(
  state: ChatState,
  message: string,
  attachments?: ChatAttachment[],
): Promise<string | null> {
  if (!state.client || !state.connected) {
    return null;
  }
  // Bind this send to the session (and composer draft) it was started for:
  // a session switch during the in-flight request must not let the response
  // mutate the new session's state, clear its draft, or arm its retry.
  const sessionKey = state.sessionKey;
  const draftKey = composerDraftKey(state);
  const msg = message.trim();
  const hasAttachments = attachments && attachments.length > 0;
  if (!msg && !hasAttachments) {
    return null;
  }

  const now = Date.now();

  // Build user message content blocks
  const contentBlocks: Array<{ type: string; text?: string; source?: unknown }> = [];
  if (msg) {
    contentBlocks.push({ type: "text", text: msg });
  }
  // Add image previews to the message for display
  if (hasAttachments) {
    for (const att of attachments) {
      contentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: att.mimeType, data: att.dataUrl },
      });
    }
  }

  state.chatMessages = [
    ...state.chatMessages,
    {
      role: "user",
      content: contentBlocks,
      timestamp: now,
    },
  ];

  state.chatSending = true;
  state.lastError = null;
  const runId = generateUUID();
  state.chatRunId = runId;
  state.chatStream = "";
  state.chatStreamStartedAt = now;

  // Convert attachments to API format
  const apiAttachments = hasAttachments
    ? attachments
        .map((att) => {
          const parsed = dataUrlToBase64(att.dataUrl);
          if (!parsed) {
            return null;
          }
          return {
            type: "image",
            mimeType: parsed.mimeType,
            content: parsed.content,
          };
        })
        .filter((a): a is NonNullable<typeof a> => a !== null)
    : undefined;

  try {
    await state.client.request("chat.send", {
      sessionKey,
      message: msg,
      deliver: false,
      idempotencyKey: runId,
      attachments: apiAttachments,
    });
    if (state.sessionKey !== sessionKey) {
      // Session switched mid-send: the new session's state is off-limits, but
      // the old session's draft was consumed by this send — clear it by its
      // own key (never by whatever session is active now).
      clearComposerDraft(state, draftKey);
      return runId;
    }
    state.lastFailedSend = null;
    // The send went through, so the persisted draft is consumed.
    clearComposerDraft(state);
    return runId;
  } catch (err) {
    if (state.sessionKey !== sessionKey) {
      // Session switched mid-send: drop the failure entirely — the error
      // bubble and retry payload must not bleed into the new session.
      return null;
    }
    const error = String(err);
    state.chatRunId = null;
    state.chatStream = null;
    state.chatStreamStartedAt = null;
    state.lastError = error;
    // Remember the failed payload so the view can offer a one-click retry
    // (retryLastFailedSend below). View integration point: app-render.ts's
    // renderChat call already forwards state fields to views/chat.ts — pass
    // state.lastFailedSend as a prop (like showNewMessages) and render a
    // "Retry" affordance on the error bubble / next to the composer.
    // Text-only: attachment sends are excluded — retryLastFailedSend always
    // re-sends plain text and would silently drop the images.
    if (!hasAttachments) {
      state.lastFailedSend = { text: msg, at: now };
    }
    state.chatMessages = [
      ...state.chatMessages,
      {
        role: "assistant",
        content: [{ type: "text", text: "Error: " + error }],
        timestamp: Date.now(),
        // Affordance marker for the view: this bubble is a send failure that
        // can be retried via retryLastFailedSend() while lastFailedSend is set.
        sendFailedRetryable: true,
      },
    ];
    return null;
  } finally {
    // Intentionally not session-guarded: a switched-away send must still
    // release the flag, or chatSending would stick true forever (the session
    // switch path doesn't reset it) and every later send would just queue.
    state.chatSending = false;
  }
}

/**
 * Re-sends the payload stored on state.lastFailedSend and clears it on
 * success. No-op when nothing is pending, a send is already in flight, or the
 * client is disconnected.
 */
export async function retryLastFailedSend(state: ChatState): Promise<string | null> {
  const failed = state.lastFailedSend;
  if (!failed || state.chatSending) {
    return null;
  }
  // Clear before awaiting so a double-click cannot double-send. sendChatMessage
  // re-arms lastFailedSend itself when the retry fails at the gateway layer;
  // the restore below covers bailing out before the request (e.g. disconnect).
  state.lastFailedSend = null;
  try {
    const runId = await sendChatMessage(state, failed.text);
    if (!runId && !state.lastFailedSend) {
      state.lastFailedSend = failed;
    }
    return runId;
  } catch (err) {
    state.lastFailedSend = failed;
    throw err;
  }
}

export async function abortChatRun(state: ChatState): Promise<boolean> {
  if (!state.client || !state.connected) {
    return false;
  }
  const runId = state.chatRunId;
  try {
    await state.client.request(
      "chat.abort",
      runId ? { sessionKey: state.sessionKey, runId } : { sessionKey: state.sessionKey },
    );
    return true;
  } catch (err) {
    state.lastError = String(err);
    return false;
  }
}

export function handleChatEvent(state: ChatState, payload?: ChatEventPayload) {
  if (!payload) {
    return null;
  }
  if (payload.sessionKey !== state.sessionKey) {
    return null;
  }

  // Final from another run (e.g. sub-agent announce): refresh history to show new message.
  // See https://github.com/paleoclaw/paleoclaw/issues/1909
  if (payload.runId && state.chatRunId && payload.runId !== state.chatRunId) {
    if (payload.state === "final") {
      const finalMessage = normalizeFinalAssistantMessage(payload.message);
      if (finalMessage && !isAssistantSilentReply(finalMessage)) {
        state.chatMessages = [...state.chatMessages, finalMessage];
        return null;
      }
      return "final";
    }
    return null;
  }

  if (payload.state === "delta") {
    const next = extractText(payload.message);
    if (typeof next === "string" && !isSilentReplyStream(next)) {
      const current = state.chatStream ?? "";
      // Accept the new delta if:
      //  - it is non-empty (an empty delta must never wipe accumulated text —
      //    current.startsWith("") would otherwise always match), AND
      //  - no accumulated text yet, OR
      //  - the new text is at least as long as current (normal stream growth), OR
      //  - the new text is a prefix of current (server legitimately shortened
      //    the output — e.g. stripping thinking tags, NO_REPLY filtering).
      // This prevents stale out-of-order deltas from overriding newer text
      // while allowing the server to clean up intermediate output.
      if (
        next.length > 0 &&
        (!current || next.length >= current.length || current.startsWith(next))
      ) {
        state.chatStream = next;
      }
    }
  } else if (payload.state === "final") {
    const finalMessage = normalizeFinalAssistantMessage(payload.message);
    if (finalMessage && !isAssistantSilentReply(finalMessage)) {
      state.chatMessages = [...state.chatMessages, finalMessage];
    } else if (state.chatStream?.trim() && !isSilentReplyCommit(state.chatStream)) {
      state.chatMessages = [
        ...state.chatMessages,
        {
          role: "assistant",
          content: [{ type: "text", text: state.chatStream }],
          timestamp: Date.now(),
        },
      ];
    }
    state.chatStream = null;
    state.chatRunId = null;
    state.chatStreamStartedAt = null;
  } else if (payload.state === "aborted") {
    const normalizedMessage = normalizeAbortedAssistantMessage(payload.message);
    if (normalizedMessage && !isAssistantSilentReply(normalizedMessage)) {
      state.chatMessages = [...state.chatMessages, normalizedMessage];
    } else {
      const streamedText = state.chatStream ?? "";
      if (streamedText.trim() && !isSilentReplyCommit(streamedText)) {
        state.chatMessages = [
          ...state.chatMessages,
          {
            role: "assistant",
            content: [{ type: "text", text: streamedText }],
            timestamp: Date.now(),
          },
        ];
      }
    }
    state.chatStream = null;
    state.chatRunId = null;
    state.chatStreamStartedAt = null;
  } else if (payload.state === "error") {
    state.chatStream = null;
    state.chatRunId = null;
    state.chatStreamStartedAt = null;
    state.lastError = payload.errorMessage ?? "chat error";
  }
  return payload.state;
}
