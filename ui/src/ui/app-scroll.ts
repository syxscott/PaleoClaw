/** Distance (px) from the bottom within which we consider the user "near bottom". */
const NEAR_BOTTOM_THRESHOLD = 450;

/** Per-session scroll memory: remember at most this many sessions (LRU). */
const SCROLL_MEMORY_LIMIT = 50;

type ScrollHost = {
  updateComplete: Promise<unknown>;
  querySelector: (selectors: string) => Element | null;
  style: CSSStyleDeclaration;
  chatScrollFrame: number | null;
  chatScrollTimeout: number | null;
  chatHasAutoScrolled: boolean;
  chatUserNearBottom: boolean;
  chatNewMessagesBelow: boolean;
  logsScrollFrame: number | null;
  logsAtBottom: boolean;
  topbarObserver: ResizeObserver | null;
  /** Current chat session key. Present on the app host; test stubs may omit it. */
  sessionKey?: string;
};

/*
 * Per-session scroll memory + "new messages below" pill.
 *
 * - `scrollMemory` is an LRU of the last scrollTop per session key. The
 *   outgoing session's position is committed when a switch is detected
 *   (resetChatScroll / scheduleChatScroll compare host.sessionKey against the
 *   tracker) and restored for the incoming session after render
 *   (requestAnimationFrame) via consumePendingChatRestore.
 * - `chatNewMessagesBelow` (existing host state) is the pill channel: when a
 *   message arrives while the user is scrolled beyond the near-bottom
 *   threshold, scheduleChatScroll sets it, and the view renders it as the
 *   "New messages" pill (views/chat.ts `showNewMessages`, fed from
 *   app-render.ts). app-scroll only sets/clears the flag — unchanged.
 */
const scrollMemory = new Map<string, number>();
const sessionTracker = new WeakMap<ScrollHost, { key: string; scrollTop: number }>();
const pendingRestores = new WeakMap<ScrollHost, string>();
/** Timestamp of the last restore, to keep it from flagging the pill below. */
const chatRestoreJustAppliedAt = new WeakMap<ScrollHost, number>();
const RESTORE_PILL_SUPPRESS_MS = 300;

function wasRecentlyRestored(host: ScrollHost): boolean {
  const at = chatRestoreJustAppliedAt.get(host);
  return at !== undefined && Date.now() - at < RESTORE_PILL_SUPPRESS_MS;
}

function pickChatScrollTarget(host: ScrollHost): HTMLElement | null {
  const container = host.querySelector(".chat-thread") as HTMLElement | null;
  if (container) {
    const overflowY = getComputedStyle(container).overflowY;
    const canScroll =
      overflowY === "auto" ||
      overflowY === "scroll" ||
      container.scrollHeight - container.clientHeight > 1;
    if (canScroll) {
      return container;
    }
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement | null;
}

function commitScrollPosition(key: string, scrollTop: number) {
  if (!Number.isFinite(scrollTop) || scrollTop <= 0) {
    scrollMemory.delete(key);
    return;
  }
  // Re-insert to refresh LRU order, then evict the oldest entry over the cap.
  scrollMemory.delete(key);
  scrollMemory.set(key, Math.floor(scrollTop));
  while (scrollMemory.size > SCROLL_MEMORY_LIMIT) {
    const oldest = scrollMemory.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    scrollMemory.delete(oldest);
  }
}

/**
 * Detects session switches: commits the outgoing session's scroll position to
 * the LRU memory and primes the tracker/pending-restore for the incoming one.
 * No-op for hosts without a sessionKey (e.g. unit-test stubs).
 */
function trackChatSession(host: ScrollHost) {
  const sessionKey = host.sessionKey;
  if (!sessionKey) {
    return;
  }
  const tracked = sessionTracker.get(host);
  if (tracked && tracked.key !== sessionKey) {
    commitScrollPosition(tracked.key, tracked.scrollTop);
  }
  if (!tracked || tracked.key !== sessionKey) {
    sessionTracker.set(host, {
      key: sessionKey,
      scrollTop: scrollMemory.get(sessionKey) ?? 0,
    });
    pendingRestores.set(host, sessionKey);
  }
}

function noteScrollPosition(host: ScrollHost, target: HTMLElement) {
  const tracked = sessionTracker.get(host);
  if (tracked && tracked.key === host.sessionKey) {
    tracked.scrollTop = target.scrollTop;
  }
}

/**
 * Restores the remembered scroll position for the pending session after render
 * (updateComplete + requestAnimationFrame). Idempotent: the pending marker is
 * consumed on the first attempt, so resetChatScroll and scheduleChatScroll can
 * both trigger it safely.
 */
function consumePendingChatRestore(host: ScrollHost) {
  const sessionKey = host.sessionKey;
  if (!sessionKey || pendingRestores.get(host) !== sessionKey) {
    return;
  }
  const saved = scrollMemory.get(sessionKey);
  pendingRestores.delete(host);
  if (saved === undefined || saved <= 0) {
    return;
  }
  void host.updateComplete.then(() => {
    requestAnimationFrame(() => {
      const target = pickChatScrollTarget(host);
      if (!target) {
        return;
      }
      target.scrollTop = saved;
      // The position is established — don't let the one-shot initial-load
      // force-scroll yank the user back to the bottom.
      host.chatHasAutoScrolled = true;
      const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
      host.chatUserNearBottom = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
      if (host.chatUserNearBottom) {
        host.chatNewMessagesBelow = false;
      }
      chatRestoreJustAppliedAt.set(host, Date.now());
      noteScrollPosition(host, target);
    });
  });
}

export function scheduleChatScroll(host: ScrollHost, force = false, smooth = false) {
  trackChatSession(host);
  consumePendingChatRestore(host);
  if (host.chatScrollFrame) {
    cancelAnimationFrame(host.chatScrollFrame);
  }
  if (host.chatScrollTimeout != null) {
    clearTimeout(host.chatScrollTimeout);
    host.chatScrollTimeout = null;
  }
  // Wait for Lit render to complete, then scroll
  void host.updateComplete.then(() => {
    host.chatScrollFrame = requestAnimationFrame(() => {
      host.chatScrollFrame = null;
      const target = pickChatScrollTarget(host);
      if (!target) {
        return;
      }
      const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;

      // force=true only overrides when we haven't auto-scrolled yet (initial load).
      // After initial load, respect the user's scroll position.
      const effectiveForce = force && !host.chatHasAutoScrolled;
      const shouldStick =
        effectiveForce || host.chatUserNearBottom || distanceFromBottom < NEAR_BOTTOM_THRESHOLD;

      if (!shouldStick) {
        // User is scrolled up — flag that new content arrived below, unless
        // the position was just restored from per-session memory (a plain
        // session switch must not raise the "new messages" pill).
        if (!wasRecentlyRestored(host)) {
          host.chatNewMessagesBelow = true;
        }
        return;
      }
      if (effectiveForce) {
        host.chatHasAutoScrolled = true;
      }
      const smoothEnabled =
        smooth &&
        (typeof window === "undefined" ||
          typeof window.matchMedia !== "function" ||
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      const scrollTop = target.scrollHeight;
      if (typeof target.scrollTo === "function") {
        target.scrollTo({ top: scrollTop, behavior: smoothEnabled ? "smooth" : "auto" });
      } else {
        target.scrollTop = scrollTop;
      }
      host.chatUserNearBottom = true;
      host.chatNewMessagesBelow = false;
      noteScrollPosition(host, target);
      const retryDelay = effectiveForce ? 150 : 120;
      host.chatScrollTimeout = window.setTimeout(() => {
        host.chatScrollTimeout = null;
        const latest = pickChatScrollTarget(host);
        if (!latest) {
          return;
        }
        const latestDistanceFromBottom =
          latest.scrollHeight - latest.scrollTop - latest.clientHeight;
        const shouldStickRetry =
          effectiveForce ||
          host.chatUserNearBottom ||
          latestDistanceFromBottom < NEAR_BOTTOM_THRESHOLD;
        if (!shouldStickRetry) {
          return;
        }
        latest.scrollTop = latest.scrollHeight;
        host.chatUserNearBottom = true;
        noteScrollPosition(host, latest);
      }, retryDelay);
    });
  });
}

export function scheduleLogsScroll(host: ScrollHost, force = false) {
  if (host.logsScrollFrame) {
    cancelAnimationFrame(host.logsScrollFrame);
  }
  void host.updateComplete.then(() => {
    host.logsScrollFrame = requestAnimationFrame(() => {
      host.logsScrollFrame = null;
      const container = host.querySelector(".log-stream") as HTMLElement | null;
      if (!container) {
        return;
      }
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      const shouldStick = force || distanceFromBottom < 80;
      if (!shouldStick) {
        return;
      }
      container.scrollTop = container.scrollHeight;
    });
  });
}

export function handleChatScroll(host: ScrollHost, event: Event) {
  const container = event.currentTarget as HTMLElement | null;
  if (!container) {
    return;
  }
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  host.chatUserNearBottom = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
  // Clear the "new messages below" indicator when user scrolls back to bottom.
  if (host.chatUserNearBottom) {
    host.chatNewMessagesBelow = false;
  }
  trackChatSession(host);
  noteScrollPosition(host, container);
}

export function handleLogsScroll(host: ScrollHost, event: Event) {
  const container = event.currentTarget as HTMLElement | null;
  if (!container) {
    return;
  }
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  host.logsAtBottom = distanceFromBottom < 80;
}

export function resetChatScroll(host: ScrollHost) {
  // Commit the outgoing session's position, then schedule the incoming
  // session's restore (both no-ops when the host has no sessionKey).
  trackChatSession(host);
  consumePendingChatRestore(host);
  host.chatHasAutoScrolled = false;
  host.chatUserNearBottom = true;
  host.chatNewMessagesBelow = false;
}

export function exportLogs(lines: string[], label: string) {
  if (lines.length === 0) {
    return;
  }
  const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  anchor.href = url;
  anchor.download = `paleoclaw-logs-${label}-${stamp}.log`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function observeTopbar(host: ScrollHost) {
  if (typeof ResizeObserver === "undefined") {
    return;
  }
  const topbar = host.querySelector(".topbar");
  if (!topbar) {
    return;
  }
  const update = () => {
    const { height } = topbar.getBoundingClientRect();
    host.style.setProperty("--topbar-height", `${height}px`);
  };
  update();
  host.topbarObserver = new ResizeObserver(() => update());
  host.topbarObserver.observe(topbar);
}
