const CHECK_FN_TTL_SECONDS = 30.0;
const CHECK_FN_FAILURE_GRACE_SECONDS = 60.0;

export class ToolAvailabilityCache {
  private cache: Map<string, { ts: number; value: boolean }> = new Map();

  async check(name: string, checkFn: () => boolean | Promise<boolean>): Promise<boolean> {
    const now = Date.now() / 1000;
    const cached = this.cache.get(name);

    if (cached) {
      // Successes are trusted for the short TTL. Failures are anchored to the
      // time of the failed check (not the last success) so a persistently
      // failing dependency gets a real grace window instead of being re-probed
      // on every availability check.
      const ttl = cached.value ? CHECK_FN_TTL_SECONDS : CHECK_FN_FAILURE_GRACE_SECONDS;
      if (now - cached.ts < ttl) {
        return cached.value;
      }
    }

    // Execute check
    const result = await Promise.resolve(checkFn());
    this.cache.set(name, { ts: now, value: result });
    return result;
  }

  invalidate(name?: string): void {
    if (name) {
      this.cache.delete(name);
    } else {
      this.cache.clear();
    }
  }

  invalidateAll(): void {
    this.invalidate();
  }
}
