import { buildDeviceAuthPayload } from "../../../src/gateway/device-auth.js";
import {
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES,
  type GatewayClientMode,
  type GatewayClientName,
} from "../../../src/gateway/protocol/client-info.js";
import {
  ConnectErrorDetailCodes,
  readConnectErrorDetailCode,
} from "../../../src/gateway/protocol/connect-error-details.js";
import { clearDeviceAuthToken, loadDeviceAuthToken, storeDeviceAuthToken } from "./device-auth.ts";
import { loadOrCreateDeviceIdentity, signDevicePayload } from "./device-identity.ts";
import { generateUUID } from "./uuid.ts";

export type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: { presence: number; health: number };
};

export type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
};

export type GatewayErrorInfo = {
  code: string;
  message: string;
  details?: unknown;
};

export class GatewayRequestError extends Error {
  readonly gatewayCode: string;
  readonly details?: unknown;

  constructor(error: GatewayErrorInfo) {
    super(error.message);
    this.name = "GatewayRequestError";
    this.gatewayCode = error.code;
    this.details = error.details;
  }
}

export function resolveGatewayErrorDetailCode(
  error: { details?: unknown } | null | undefined,
): string | null {
  return readConnectErrorDetailCode(error?.details);
}

/**
 * Auth errors that won't resolve without user action — don't auto-reconnect.
 *
 * NOTE: AUTH_TOKEN_MISMATCH is intentionally NOT included here because the
 * browser client has a device-token fallback flow: a stale cached device token
 * triggers a mismatch, sendConnect() clears it, and the next reconnect retries
 * with opts.token (the shared gateway token). Blocking reconnect on mismatch
 * would break that fallback. The rate limiter still catches persistent wrong
 * tokens after N failures → AUTH_RATE_LIMITED stops the loop.
 */
export function isNonRecoverableAuthError(error: GatewayErrorInfo | undefined): boolean {
  if (!error) {
    return false;
  }
  const code = resolveGatewayErrorDetailCode(error);
  return (
    code === ConnectErrorDetailCodes.AUTH_TOKEN_MISSING ||
    code === ConnectErrorDetailCodes.AUTH_PASSWORD_MISSING ||
    code === ConnectErrorDetailCodes.AUTH_PASSWORD_MISMATCH ||
    code === ConnectErrorDetailCodes.AUTH_RATE_LIMITED
  );
}

export type GatewayHelloOk = {
  type: "hello-ok";
  protocol: number;
  server?: {
    version?: string;
    connId?: string;
  };
  features?: { methods?: string[]; events?: string[] };
  snapshot?: unknown;
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
    issuedAtMs?: number;
  };
  policy?: { tickIntervalMs?: number };
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
};

export type GatewayBrowserClientOptions = {
  url: string;
  token?: string;
  password?: string;
  clientName?: GatewayClientName;
  clientVersion?: string;
  platform?: string;
  mode?: GatewayClientMode;
  instanceId?: string;
  onHello?: (hello: GatewayHelloOk) => void;
  onEvent?: (evt: GatewayEventFrame) => void;
  onClose?: (info: { code: number; reason: string; error?: GatewayErrorInfo }) => void;
  onGap?: (info: { expected: number; received: number }) => void;
};

// 4008 = application-defined code (browser rejects 1008 "Policy Violation")
const CONNECT_FAILED_CLOSE_CODE = 4008;

// Wake/online recovery tuning (pattern borrowed from the 9.2 control UI's
// gateway-page-activation.ts): after a tab suspension or BFCache resume Safari
// keeps "ghost" sockets that report OPEN but never deliver frames again.
// Inbound silence beyond 2x the server tick is treated as a dead socket.
const DEFAULT_TICK_INTERVAL_MS = 30_000;
const MIN_WAKE_SILENCE_MS = 5_000;
/** A socket still stuck in CONNECTING this long after a wake is a ghost. */
const CONNECTING_GHOST_TIMEOUT_MS = 10_000;
const BASE_BACKOFF_MS = 800;

export class GatewayBrowserClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private closed = false;
  private lastSeq: number | null = null;
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private backoffMs = 800;
  private pendingConnectError: GatewayErrorInfo | undefined;
  // Wake/online recovery state (see needsWakeReconnect).
  private lastInboundAtMs: number | null = null;
  private maxInboundSilenceMs: number | null = null;
  private connectStartedAtMs = 0;
  private fatalClose = false;
  private wakeCheckQueued = false;
  private wakeForceRecovery = false;
  private wakeWasHidden =
    typeof document !== "undefined" && document.visibilityState === "hidden";
  private onVisibilityChange: (() => void) | null = null;
  private onOnline: (() => void) | null = null;
  private onPageShow: ((event: PageTransitionEvent) => void) | null = null;

  constructor(private opts: GatewayBrowserClientOptions) {}

  start() {
    this.closed = false;
    this.fatalClose = false;
    this.attachWakeListeners();
    this.connect();
  }

  stop() {
    this.closed = true;
    this.detachWakeListeners();
    // Clear any pending timers so callbacks don't fire after stop() and try
    // to use a disposed WebSocket.
    this.connectTimer = this.clearWindowTimer(this.connectTimer);
    this.reconnectTimer = this.clearWindowTimer(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.pendingConnectError = undefined;
    this.lastInboundAtMs = null;
    this.maxInboundSilenceMs = null;
    this.flushPending(new Error("gateway client stopped"));
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * True when the transport is down or suspiciously silent — e.g. Safari
   * resumes a suspended tab with a ghost socket that reports OPEN but is dead.
   * The wake/online listeners trigger the existing reconnect path when this is
   * set, bypassing the remaining backoff delay.
   */
  get needsWakeReconnect() {
    if (!this.connected) {
      const ws = this.ws;
      if (ws && ws.readyState === WebSocket.CONNECTING) {
        // Fresh dial: give it a moment before calling it a ghost.
        return Date.now() - this.connectStartedAtMs > CONNECTING_GHOST_TIMEOUT_MS;
      }
      // A non-recoverable auth close intentionally left the client stopped;
      // waking the tab must not hammer the gateway with doomed retries.
      return !this.fatalClose || ws !== null;
    }
    return (
      this.lastInboundAtMs !== null &&
      this.maxInboundSilenceMs !== null &&
      Date.now() - this.lastInboundAtMs > this.maxInboundSilenceMs
    );
  }

  private attachWakeListeners() {
    if (this.onVisibilityChange || this.onOnline || this.onPageShow) {
      return;
    }
    if (typeof document !== "undefined") {
      this.onVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
          this.wakeWasHidden = true;
          return;
        }
        // Only recover on the hidden → visible transition, not every blip.
        if (this.wakeWasHidden) {
          this.wakeWasHidden = false;
          this.scheduleWakeRecovery(false);
        }
      };
      document.addEventListener("visibilitychange", this.onVisibilityChange);
    }
    // Node/test environments may lack `window` entirely or provide a partial
    // stub without listener support — skip wake listeners there.
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
      return;
    }
    this.onOnline = () => this.scheduleWakeRecovery(false);
    this.onPageShow = (event: PageTransitionEvent) => {
      // BFCache resume: the old socket is a ghost even when it reports OPEN.
      if (event.persisted) {
        this.scheduleWakeRecovery(true);
      }
    };
    window.addEventListener("online", this.onOnline);
    window.addEventListener("pageshow", this.onPageShow);
  }

  private detachWakeListeners() {
    if (this.onVisibilityChange) {
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
      this.onVisibilityChange = null;
    }
    const canRemoveWindowListeners =
      typeof window !== "undefined" && typeof window.removeEventListener === "function";
    if (this.onOnline) {
      if (canRemoveWindowListeners) {
        window.removeEventListener("online", this.onOnline);
      }
      this.onOnline = null;
    }
    if (this.onPageShow) {
      if (canRemoveWindowListeners) {
        window.removeEventListener("pageshow", this.onPageShow);
      }
      this.onPageShow = null;
    }
    this.wakeCheckQueued = false;
    this.wakeForceRecovery = false;
  }

  /**
   * window-timer helpers: non-browser environments (node test runs, SSR) may
   * lack `window`, so timers are simply never scheduled/cleared there. Browser
   * behavior is unchanged.
   */
  private clearWindowTimer(timer: number | null): null {
    if (timer !== null && typeof window !== "undefined") {
      window.clearTimeout(timer);
    }
    return null;
  }

  private setWindowTimer(handler: () => void, delay: number): number | null {
    if (typeof window === "undefined") {
      return null;
    }
    return window.setTimeout(handler, delay);
  }

  private scheduleWakeRecovery(force: boolean) {
    if (this.closed) {
      return;
    }
    this.wakeForceRecovery ||= force;
    if (this.wakeCheckQueued) {
      return;
    }
    this.wakeCheckQueued = true;
    queueMicrotask(() => {
      this.wakeCheckQueued = false;
      const forceRecovery = this.wakeForceRecovery;
      this.wakeForceRecovery = false;
      if (this.closed) {
        return;
      }
      if (!forceRecovery && !this.needsWakeReconnect) {
        return;
      }
      this.recoverConnection();
    });
  }

  /**
   * Retire the current transport (if any) and reconnect immediately through
   * the normal connect() path, bypassing any pending backoff delay. The
   * socket-identity guards in connect() ensure the retired ghost's late close
   * event neither clears the live socket nor schedules a duplicate reconnect.
   */
  private recoverConnection() {
    const ghost = this.ws;
    this.ws = null;
    this.connectTimer = this.clearWindowTimer(this.connectTimer);
    this.reconnectTimer = this.clearWindowTimer(this.reconnectTimer);
    this.connectSent = false;
    this.connectNonce = null;
    this.backoffMs = BASE_BACKOFF_MS;
    this.lastInboundAtMs = Date.now();
    if (ghost) {
      this.flushPending(new Error("gateway connection reset after page wake"));
      try {
        ghost.close();
      } catch {
        // The ghost socket may already be gone.
      }
    }
    this.connect();
  }

  private connect() {
    if (this.closed) {
      return;
    }
    const socket = new WebSocket(this.opts.url);
    this.ws = socket;
    this.connectStartedAtMs = Date.now();
    // Socket-identity guard: events from a socket that was replaced (wake
    // recovery) or orphaned must not touch current client state.
    const isCurrentSocket = () => this.ws === socket;
    socket.addEventListener("open", () => {
      if (!isCurrentSocket()) {
        return;
      }
      this.lastInboundAtMs = Date.now();
      this.queueConnect();
    });
    socket.addEventListener("message", (ev) => {
      if (!isCurrentSocket()) {
        return;
      }
      this.handleMessage(String(ev.data ?? ""));
    });
    socket.addEventListener("close", (ev) => {
      if (!isCurrentSocket()) {
        return;
      }
      const reason = String(ev.reason ?? "");
      const connectError = this.pendingConnectError;
      this.pendingConnectError = undefined;
      this.ws = null;
      this.flushPending(new Error(`gateway closed (${ev.code}): ${reason}`));
      this.opts.onClose?.({ code: ev.code, reason, error: connectError });
      if (isNonRecoverableAuthError(connectError)) {
        this.fatalClose = true;
        return;
      }
      this.scheduleReconnect();
    });
    socket.addEventListener("error", () => {
      // ignored; close handler will fire
    });
  }

  private scheduleReconnect() {
    if (this.closed) {
      return;
    }
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15_000);
    this.clearWindowTimer(this.reconnectTimer);
    this.reconnectTimer = this.setWindowTimer(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /** Gateway ticks bound how long inbound silence may be before a wake is suspect. */
  private applyTickPolicy(hello: GatewayHelloOk) {
    const advertised = hello.policy?.tickIntervalMs;
    const tickIntervalMs =
      typeof advertised === "number" && Number.isFinite(advertised) && advertised > 0
        ? advertised
        : DEFAULT_TICK_INTERVAL_MS;
    this.maxInboundSilenceMs = Math.max(tickIntervalMs * 2, MIN_WAKE_SILENCE_MS);
    this.lastInboundAtMs = Date.now();
  }

  private flushPending(err: Error) {
    for (const [, p] of this.pending) {
      p.reject(err);
    }
    this.pending.clear();
  }

  private async sendConnect() {
    if (this.connectSent) {
      return;
    }
    this.connectSent = true;
    this.connectTimer = this.clearWindowTimer(this.connectTimer);

    // crypto.subtle is only available in secure contexts (HTTPS, localhost).
    // Over plain HTTP, we skip device identity and fall back to token-only auth.
    // Gateways may reject this unless gateway.controlUi.allowInsecureAuth is enabled.
    const isSecureContext = typeof crypto !== "undefined" && !!crypto.subtle;

    const scopes = ["operator.admin", "operator.approvals", "operator.pairing"];
    const role = "operator";
    let deviceIdentity: Awaited<ReturnType<typeof loadOrCreateDeviceIdentity>> | null = null;
    let canFallbackToShared = false;
    let authToken = this.opts.token;
    let deviceToken: string | undefined;

    if (isSecureContext) {
      deviceIdentity = await loadOrCreateDeviceIdentity();
      deviceToken = loadDeviceAuthToken({
        deviceId: deviceIdentity.deviceId,
        role,
      })?.token;
      canFallbackToShared = Boolean(deviceToken && this.opts.token);
    }
    const auth =
      authToken || this.opts.password
        ? {
            token: authToken,
            password: this.opts.password,
          }
        : undefined;

    let device:
      | {
          id: string;
          publicKey: string;
          signature: string;
          signedAt: number;
          nonce: string;
        }
      | undefined;

    if (isSecureContext && deviceIdentity) {
      const signedAtMs = Date.now();
      const nonce = this.connectNonce ?? "";
      const payload = buildDeviceAuthPayload({
        deviceId: deviceIdentity.deviceId,
        clientId: this.opts.clientName ?? GATEWAY_CLIENT_NAMES.CONTROL_UI,
        clientMode: this.opts.mode ?? GATEWAY_CLIENT_MODES.WEBCHAT,
        role,
        scopes,
        signedAtMs,
        token: deviceToken ?? null,
        nonce,
      });
      const signature = await signDevicePayload(deviceIdentity.privateKey, payload);
      device = {
        id: deviceIdentity.deviceId,
        publicKey: deviceIdentity.publicKey,
        signature,
        signedAt: signedAtMs,
        nonce,
      };
    }
    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: this.opts.clientName ?? GATEWAY_CLIENT_NAMES.CONTROL_UI,
        version: this.opts.clientVersion ?? "control-ui",
        platform: this.opts.platform ?? navigator.platform ?? "web",
        mode: this.opts.mode ?? GATEWAY_CLIENT_MODES.WEBCHAT,
        instanceId: this.opts.instanceId,
      },
      role,
      scopes,
      device,
      caps: ["tool-events"],
      auth,
      userAgent: navigator.userAgent,
      locale: navigator.language,
    };

    void this.request<GatewayHelloOk>("connect", params)
      .then((hello) => {
        if (hello?.auth?.deviceToken && deviceIdentity) {
          storeDeviceAuthToken({
            deviceId: deviceIdentity.deviceId,
            role: hello.auth.role ?? role,
            token: hello.auth.deviceToken,
            scopes: hello.auth.scopes ?? [],
          });
        }
        this.fatalClose = false;
        this.applyTickPolicy(hello);
        this.backoffMs = BASE_BACKOFF_MS;
        this.opts.onHello?.(hello);
      })
      .catch((err: unknown) => {
        // Only a structured auth/device rejection (GatewayRequestError carrying
        // a connect-error detail code — see ConnectErrorDetailCodes) may clear
        // the device token and force-close the socket. Plain transport failures
        // (socket died mid-handshake, ghost retired during async signing) must
        // keep both: the normal close/reconnect machinery handles those.
        const authRejected =
          err instanceof GatewayRequestError && resolveGatewayErrorDetailCode(err) !== null;
        if (err instanceof GatewayRequestError) {
          this.pendingConnectError = {
            code: err.gatewayCode,
            message: err.message,
            details: err.details,
          };
        } else {
          this.pendingConnectError = undefined;
        }
        if (authRejected && canFallbackToShared && deviceIdentity) {
          clearDeviceAuthToken({ deviceId: deviceIdentity.deviceId, role });
        }
        if (authRejected) {
          this.ws?.close(CONNECT_FAILED_CLOSE_CODE, "connect failed");
        }
      });
  }

  private handleMessage(raw: string) {
    // Any inbound frame proves the transport is alive, even unparsable ones.
    this.lastInboundAtMs = Date.now();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as { type?: unknown };
    if (frame.type === "event") {
      const evt = parsed as GatewayEventFrame;
      if (evt.event === "connect.challenge") {
        const payload = evt.payload as { nonce?: unknown } | undefined;
        const nonce = payload && typeof payload.nonce === "string" ? payload.nonce : null;
        if (nonce) {
          this.connectNonce = nonce;
          void this.sendConnect();
        }
        return;
      }
      const seq = typeof evt.seq === "number" ? evt.seq : null;
      if (seq !== null) {
        if (this.lastSeq !== null && seq > this.lastSeq + 1) {
          this.opts.onGap?.({ expected: this.lastSeq + 1, received: seq });
        }
        this.lastSeq = seq;
      }
      try {
        this.opts.onEvent?.(evt);
      } catch (err) {
        console.error("[gateway] event handler error:", err);
      }
      return;
    }

    if (frame.type === "res") {
      const res = parsed as GatewayResponseFrame;
      const pending = this.pending.get(res.id);
      if (!pending) {
        return;
      }
      this.pending.delete(res.id);
      if (res.ok) {
        pending.resolve(res.payload);
      } else {
        pending.reject(
          new GatewayRequestError({
            code: res.error?.code ?? "UNAVAILABLE",
            message: res.error?.message ?? "request failed",
            details: res.error?.details,
          }),
        );
      }
      return;
    }
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("gateway not connected"));
    }
    const id = generateUUID();
    const frame = { type: "req", id, method, params };
    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject });
    });
    this.ws.send(JSON.stringify(frame));
    return p;
  }

  private queueConnect() {
    this.connectNonce = null;
    this.connectSent = false;
    this.clearWindowTimer(this.connectTimer);
    this.connectTimer = this.setWindowTimer(() => {
      void this.sendConnect();
    }, 750);
  }
}
