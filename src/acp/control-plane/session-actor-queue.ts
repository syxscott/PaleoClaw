import { KeyedAsyncQueue } from "../../plugin-sdk/keyed-async-queue.js";

/** Per-session async queue that serializes ACP runtime operations and exposes queue depth. */
export class SessionActorQueue {
  private readonly queue = new KeyedAsyncQueue();
  private pendingCount = 0;

  getTailMapForTesting(): Map<string, Promise<void>> {
    return this.queue.getTailMapForTesting();
  }

  getTotalPendingCount(): number {
    return this.pendingCount;
  }

  async run<T>(actorKey: string, op: () => Promise<T>): Promise<T> {
    return this.queue.enqueue(actorKey, op, {
      onEnqueue: () => {
        this.pendingCount += 1;
      },
      // Note: onSettle fires when the operation's promise settles (resolves/rejects),
      // which is before the result is returned to the caller. The pending count
      // therefore represents "operations dequeued but not yet delivered to caller".
      // This is intentional for backpressure monitoring - it reflects when the
      // queue has capacity to accept new work, not when callers have processed results.
      onSettle: () => {
        // Keep queue-depth accounting symmetric with enqueue even when operations reject.
        this.pendingCount -= 1;
      },
    });
  }
}
