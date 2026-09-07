export type KeyedAsyncQueueHooks = {
  onEnqueue?: () => void;
  onSettle?: () => void;
};

export function enqueueKeyedTask<T>(params: {
  tails: Map<string, Promise<void>>;
  key: string;
  task: () => Promise<T>;
  hooks?: KeyedAsyncQueueHooks;
}): Promise<T> {
  params.hooks?.onEnqueue?.();
  const previous = params.tails.get(params.key) ?? Promise.resolve();
  const current = previous
    .catch(() => undefined)
    .then(params.task)
    .finally(() => {
      params.hooks?.onSettle?.();
    });
  // Store a rejection-swallowed tail: chained tasks must not inherit the
  // previous task's rejection, and the stored promise must never produce an
  // unhandled rejection (which would crash the process under Node's default
  // unhandled-rejection behavior).
  const tail = current.then(
    () => undefined,
    () => undefined,
  );
  params.tails.set(params.key, tail);
  void tail.finally(() => {
    if (params.tails.get(params.key) === tail) {
      params.tails.delete(params.key);
    }
  });
  return current;
}

export class KeyedAsyncQueue {
  private readonly tails = new Map<string, Promise<void>>();

  getTailMapForTesting(): Map<string, Promise<void>> {
    return this.tails;
  }

  enqueue<T>(key: string, task: () => Promise<T>, hooks?: KeyedAsyncQueueHooks): Promise<T> {
    return enqueueKeyedTask({
      tails: this.tails,
      key,
      task,
      ...(hooks ? { hooks } : {}),
    });
  }
}
