/**
 * Small TTL-based message-id dedup for WeCom callbacks
 * (WeCom redelivers callbacks until it receives a 200; the gateway may also
 * see retries. Ported TTL from hermes-agent: 300 seconds.)
 */

const DEFAULT_TTL_MS = 300_000;
const MAX_ENTRIES = 1000;

export class MessageDedup {
  private readonly seen = new Map<string, number>();
  private readonly ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  isDuplicate(key: string, now = Date.now()): boolean {
    this.evict(now);
    const previous = this.seen.get(key);
    if (previous !== undefined && now - previous < this.ttlMs) {
      return true;
    }
    this.seen.set(key, now);
    if (this.seen.size > MAX_ENTRIES) {
      const oldest = this.seen.keys().next().value;
      if (oldest !== undefined) {
        this.seen.delete(oldest);
      }
    }
    return false;
  }

  clear(): void {
    this.seen.clear();
  }

  private evict(now: number): void {
    for (const [key, ts] of this.seen) {
      if (now - ts >= this.ttlMs) {
        this.seen.delete(key);
      } else {
        break; // insertion-ordered map: first fresh entry ends eviction scan
      }
    }
  }
}
