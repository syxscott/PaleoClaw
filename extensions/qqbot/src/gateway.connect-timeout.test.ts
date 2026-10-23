import { afterEach, describe, expect, it, vi } from "vitest";
import type { QqbotClient } from "./client.js";
import { QqbotGateway, type QqbotSocketHandlers } from "./gateway.js";
import type { QqbotTokenManager } from "./token.js";

const CONNECT_TIMEOUT_MS = 20_000;

function createGateway(params: {
  socketFactory: QqbotGateway["socketFactory"];
  onDispatch: (eventType: string, d: unknown, seq: number | undefined) => void;
}): QqbotGateway {
  return new QqbotGateway({
    client: {
      getGatewayUrl: async () => "wss://gateway.example/qq",
    } as unknown as QqbotClient,
    tokenManager: {} as QqbotTokenManager,
    intents: 0,
    events: { onDispatch: params.onDispatch },
    socketFactory: params.socketFactory,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("qqbot gateway connect timeout", () => {
  it("closes the socket, schedules a reconnect and detaches the stale handlers", async () => {
    vi.useFakeTimers();
    const closeSpy = vi.fn();
    const handlers: QqbotSocketHandlers[] = [];
    const onDispatch = vi.fn();
    const gateway = createGateway({
      onDispatch,
      socketFactory: () => {
        const socketHandlers: QqbotSocketHandlers = {
          onOpen: () => undefined,
          onMessage: () => undefined,
          onClose: () => undefined,
          onError: () => undefined,
        };
        handlers.push(socketHandlers);
        return { send: () => undefined, close: closeSpy };
      },
    });

    const started = gateway.start();
    const rejection = expect(started).rejects.toThrow(/connect timeout/);
    await vi.advanceTimersByTimeAsync(CONNECT_TIMEOUT_MS);
    await rejection;

    // The half-open socket is closed instead of being leaked.
    expect(closeSpy).toHaveBeenCalledTimes(1);
    // The close went through the normal path, so a retry is scheduled.
    expect(gateway.reconnect.attempt).toBe(1);
    expect(gateway.state).toBe("reconnecting");
    expect(gateway.socket).toBeNull();

    // The stale socket must not deliver messages after the failed attempt.
    handlers[0]?.onMessage(
      JSON.stringify({ op: 0, t: "C2C_MESSAGE_CREATE", d: { id: "m-1", content: "hi" } }),
    );
    handlers[0]?.onOpen();
    expect(onDispatch).not.toHaveBeenCalled();

    // The scheduled retry opens a new socket.
    await vi.advanceTimersByTimeAsync(2000);
    expect(handlers).toHaveLength(2);

    gateway.stop();
  });
});
