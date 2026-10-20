/**
 * QQ official bot WebSocket gateway client (reference adapter.py connection
 * lifecycle: Hello → Identify/Resume → heartbeat → dispatch, with close-code
 * aware reconnection driven by QqbotReconnectPolicy).
 *
 * The socket is injected via a factory so tests can drive the protocol without
 * a real network connection.
 */

import WebSocket from "ws";
import type { QqbotClient } from "./client.js";
import {
  QQ_HEARTBEAT_FALLBACK_MS,
  QQ_HEARTBEAT_SCALE,
  QQ_OP_DISPATCH,
  QQ_OP_HEARTBEAT_ACK,
  QQ_OP_HELLO,
  QQ_OP_IDENTIFY,
  QQ_OP_INVALID_SESSION,
  QQ_OP_RECONNECT,
  QQ_OP_RESUME,
} from "./constants.js";
import { QqbotReconnectPolicy, classifyQqbotCloseCode } from "./reconnect.js";
import type { QqbotTokenManager } from "./token.js";

export type QqbotGatewayState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "stopped"
  | "fatal";

export type QqbotSocketLike = {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

export type QqbotSocketHandlers = {
  onOpen: () => void;
  onMessage: (data: string) => void;
  onClose: (code: number, reason: string) => void;
  onError: (err: Error) => void;
};

export type QqbotSocketFactory = (url: string, handlers: QqbotSocketHandlers) => QqbotSocketLike;

/** Default socket factory backed by the `ws` package. */
export function wsSocketFactory(): QqbotSocketFactory {
  return (url, handlers) => {
    // handshakeTimeout is a backstop for a hung TCP/TLS handshake; the
    // gateway's own connect timeout is shorter and owns the cleanup path.
    const socket = new WebSocket(url, { handshakeTimeout: CONNECT_TIMEOUT_MS + 5_000 });
    socket.on("open", () => handlers.onOpen());
    socket.on("message", (data) => handlers.onMessage(data.toString()));
    socket.on("close", (code, reason) => handlers.onClose(code, reason.toString("utf8")));
    socket.on("error", (err) => handlers.onError(err));
    return {
      send: (payload) => socket.send(payload),
      close: (code, reason) => socket.close(code, reason),
    };
  };
}

export type QqbotGatewayEvents = {
  /** Raw op-0 dispatch (before normalization). */
  onDispatch: (eventType: string, d: unknown, seq: number | undefined) => void;
  /** State transitions for status surfacing. */
  onState?: (state: QqbotGatewayState, detail?: string) => void;
};

export type QqbotGatewayOptions = {
  client: QqbotClient;
  tokenManager: QqbotTokenManager;
  /** Intent bit field for op 2 Identify. */
  intents: number;
  events: QqbotGatewayEvents;
  socketFactory?: QqbotSocketFactory;
  reconnectPolicy?: QqbotReconnectPolicy;
  log?: {
    info?: (msg: string) => void;
    warn?: (msg: string) => void;
    error?: (msg: string) => void;
  };
};

const CONNECT_TIMEOUT_MS = 20_000;

export class QqbotGateway {
  state: QqbotGatewayState = "idle";
  /** Heartbeat interval from Hello, scaled to 80% (0 until first Hello). */
  heartbeatIntervalMs = 0;
  sessionId: string | null = null;
  lastSeq: number | null = null;
  readonly reconnect: QqbotReconnectPolicy;

  private readonly client: QqbotClient;
  private readonly tokenManager: QqbotTokenManager;
  private readonly intents: number;
  private readonly events: QqbotGatewayEvents;
  private readonly socketFactory: QqbotSocketFactory;
  private readonly log: QqbotGatewayOptions["log"];

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  /** Current transport; exposed for tests that drive the protocol directly. */
  socket: QqbotSocketLike | null = null;

  constructor(options: QqbotGatewayOptions) {
    this.client = options.client;
    this.tokenManager = options.tokenManager;
    this.intents = options.intents;
    this.events = options.events;
    this.socketFactory = options.socketFactory ?? wsSocketFactory();
    this.reconnect = options.reconnectPolicy ?? new QqbotReconnectPolicy();
    this.log = options.log;
  }

  /** Open the gateway socket and wait for the connection to establish. */
  async start(): Promise<void> {
    this.reconnect.onConnected();
    await this.openNewSocket();
  }

  /** Stop for good: no further reconnects. */
  stop(): void {
    this.reconnect.stop();
    this.setState("stopped");
    const socket = this.socket;
    this.socket = null;
    this.clearTimers();
    if (socket) {
      try {
        socket.close(1000, "client stop");
      } catch {
        // ignore close errors during shutdown
      }
    }
  }

  private setState(state: QqbotGatewayState, detail?: string): void {
    if (this.state === state && !detail) {
      return;
    }
    this.state = state;
    this.events.onState?.(state, detail);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async openNewSocket(): Promise<void> {
    this.generation += 1;
    const generation = this.generation;
    this.clearTimers();
    this.setState(this.state === "idle" ? "connecting" : "reconnecting");

    const url = await this.client.getGatewayUrl();
    this.log?.info?.(`[qqbot] connecting gateway ${url}`);

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        // Close the half-open socket and route through the normal close path so
        // the reconnect/backoff logic runs. The generation bump makes the stale
        // socket inert: it can no longer deliver messages after this attempt
        // already failed.
        this.abandonConnectAttempt(generation, "connect timeout");
        reject(new Error(`gateway connect timeout after ${CONNECT_TIMEOUT_MS}ms`));
      }, CONNECT_TIMEOUT_MS);
      const onSettled = () => {
        settled = true;
        clearTimeout(timer);
      };

      this.socket = this.socketFactory(url, {
        onOpen: () => {
          if (generation !== this.generation) {
            return;
          }
          onSettled();
          this.onSocketOpen();
          resolve();
        },
        onMessage: (data) => {
          if (generation !== this.generation) {
            return;
          }
          this.handleRawMessage(data);
        },
        onClose: (code, reason) => {
          if (generation !== this.generation) {
            return;
          }
          onSettled();
          this.handleClose(code, reason);
          // Surface close-as-connection-failure to start(): the reconnect loop
          // continues from handleClose's scheduling.
          reject(new Error(`gateway closed (code=${code}, reason=${reason})`));
        },
        onError: (err) => {
          if (generation !== this.generation) {
            return;
          }
          onSettled();
          this.log?.warn?.(`[qqbot] gateway socket error: ${err.message}`);
          reject(err);
        },
      });
    });
  }

  private onSocketOpen(): void {
    this.log?.info?.("[qqbot] gateway socket open, waiting for Hello");
  }

  /**
   * Abandon a connect attempt: close the half-open socket and route through
   * the normal close path (so the reconnect/backoff logic runs). The generation
   * bump detaches the stale socket's handlers — a socket that connects later
   * must not deliver messages after the attempt already failed.
   */
  private abandonConnectAttempt(generation: number, reason: string): void {
    if (generation !== this.generation) {
      return;
    }
    this.generation += 1;
    const stale = this.socket;
    this.socket = null;
    try {
      stale?.close(4000, reason);
    } catch {
      // ignore close errors during a failed connect
    }
    this.handleClose(4000, reason);
  }

  private scheduleReconnect(delayMs: number): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.setState("reconnecting", `retry in ${delayMs}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openNewSocket().catch((err) => {
        this.log?.warn?.(
          `[qqbot] reconnect failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        const decision = this.reconnect.onFailure();
        this.applyDecision(decision);
      });
    }, delayMs);
  }

  private applyDecision(decision: ReturnType<QqbotReconnectPolicy["onFailure"]>): void {
    if (decision.kind === "retry") {
      this.scheduleReconnect(decision.delayMs);
      return;
    }
    if (decision.kind === "give-up") {
      this.log?.error?.(`[qqbot] max reconnect attempts reached (${decision.attempt})`);
      this.setState("stopped", "max reconnect attempts");
      return;
    }
    if (decision.kind === "fatal") {
      this.log?.error?.(`[qqbot] bot is ${decision.reason}; check QQ open platform`);
      this.setState("fatal", decision.reason);
    }
  }

  /** Entry point for socket close (also used directly by tests). */
  handleClose(code: number, reason: string): void {
    this.clearTimers();
    this.socket = null;
    if (this.state === "stopped" || this.state === "fatal") {
      return;
    }
    this.log?.warn?.(`[qqbot] websocket closed: code=${code} reason=${reason}`);

    const classification = classifyQqbotCloseCode(code);
    if (classification.kind === "invalid-token") {
      this.tokenManager.invalidate();
    }
    if (classification.kind === "session-invalid") {
      this.sessionId = null;
      this.lastSeq = null;
    }
    this.applyDecision(this.reconnect.onFailure(classification));
  }

  /** Parse one WS text frame; malformed JSON is dropped (reference _parse_json). */
  handleRawMessage(data: string): void {
    let payload: unknown;
    try {
      payload = JSON.parse(data) as unknown;
    } catch {
      this.log?.warn?.(`[qqbot] failed to parse gateway JSON: ${data.slice(0, 120)}`);
      return;
    }
    this.handlePayload(payload);
  }

  /** Route one gateway payload (public for tests). */
  handlePayload(payload: unknown): void {
    if (payload === null || typeof payload !== "object") {
      return;
    }
    const record = payload as Record<string, unknown>;
    const op = typeof record.op === "number" ? record.op : undefined;
    const t = typeof record.t === "string" ? record.t : undefined;
    const s = typeof record.s === "number" ? record.s : undefined;
    const d = record.d;

    if (s !== undefined && (this.lastSeq === null || s > this.lastSeq)) {
      this.lastSeq = s;
    }

    switch (op) {
      case QQ_OP_HELLO:
        this.onHello(d);
        return;
      case QQ_OP_DISPATCH:
        if (t) {
          this.onDispatchEvent(t, d, s);
        }
        return;
      case QQ_OP_HEARTBEAT_ACK:
        return;
      case QQ_OP_RECONNECT:
        this.log?.info?.("[qqbot] server requested reconnect (op 7)");
        this.handleClose(1000, "server requested reconnect (op 7)");
        return;
      case QQ_OP_INVALID_SESSION: {
        const resumable = d === true;
        if (!resumable) {
          this.log?.info?.("[qqbot] invalid session (op 9, not resumable), clearing session");
          this.sessionId = null;
          this.lastSeq = null;
        } else {
          this.log?.info?.("[qqbot] invalid session (op 9, resumable)");
        }
        this.handleClose(1000, "invalid session (op 9)");
        return;
      }
      default:
        return;
    }
  }

  private onHello(d: unknown): void {
    const interval =
      d !== null &&
      typeof d === "object" &&
      typeof (d as Record<string, unknown>).heartbeat_interval === "number"
        ? ((d as Record<string, unknown>).heartbeat_interval as number)
        : QQ_HEARTBEAT_FALLBACK_MS;
    this.heartbeatIntervalMs = interval * QQ_HEARTBEAT_SCALE;
    this.startHeartbeat();

    const resumable = this.sessionId !== null && this.lastSeq !== null;
    if (resumable) {
      void this.sendResume();
    } else {
      void this.sendIdentify();
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    const interval =
      this.heartbeatIntervalMs > 0 ? this.heartbeatIntervalMs : QQ_HEARTBEAT_FALLBACK_MS;
    this.heartbeatTimer = setInterval(() => {
      this.sendPayload({ op: 1, d: this.lastSeq });
    }, interval);
    // Never hold the process open just for heartbeats.
    (this.heartbeatTimer as unknown as { unref?: () => void }).unref?.();
  }

  private async sendIdentify(): Promise<void> {
    try {
      const token = await this.tokenManager.getToken();
      this.sendPayload({
        op: QQ_OP_IDENTIFY,
        d: {
          token: `QQBot ${token}`,
          intents: this.intents,
          shard: [0, 1],
          properties: { $os: process.platform, $browser: "paleoclaw", $device: "paleoclaw" },
        },
      });
      this.log?.info?.("[qqbot] identify sent");
    } catch (err) {
      this.log?.error?.(
        `[qqbot] identify failed (token): ${err instanceof Error ? err.message : String(err)}`,
      );
      this.handleClose(4004, "token unavailable");
    }
  }

  private async sendResume(): Promise<void> {
    try {
      const token = await this.tokenManager.getToken();
      this.sendPayload({
        op: QQ_OP_RESUME,
        d: { token: `QQBot ${token}`, session_id: this.sessionId, seq: this.lastSeq },
      });
      this.log?.info?.(`[qqbot] resume sent (session_id=${this.sessionId}, seq=${this.lastSeq})`);
    } catch (err) {
      this.log?.warn?.(
        `[qqbot] resume failed, will re-identify: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.sessionId = null;
      this.lastSeq = null;
      await this.sendIdentify();
    }
  }

  private sendPayload(payload: Record<string, unknown>): void {
    const socket = this.socket;
    if (!socket) {
      this.log?.warn?.(`[qqbot] cannot send op=${String(payload.op)}: socket not open`);
      return;
    }
    try {
      socket.send(JSON.stringify(payload));
    } catch (err) {
      this.log?.warn?.(`[qqbot] send failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private onDispatchEvent(eventType: string, d: unknown, s: number | undefined): void {
    if (eventType === "READY") {
      const data = d !== null && typeof d === "object" ? (d as Record<string, unknown>) : {};
      this.sessionId = typeof data.session_id === "string" ? data.session_id : null;
      this.setState("connected");
      this.log?.info?.(`[qqbot] ready, session_id=${this.sessionId}`);
      return;
    }
    if (eventType === "RESUMED") {
      this.setState("connected");
      this.log?.info?.("[qqbot] session resumed");
      return;
    }
    this.events.onDispatch(eventType, d, s);
  }
}
