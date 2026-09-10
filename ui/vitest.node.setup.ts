/**
 * Setup for the node-only vitest project (vitest.node.config.ts).
 *
 * Some committed node tests exercise browser-facing controllers directly
 * (app-lifecycle.ts registers popstate listeners on `window` and their tests
 * spy on `window.removeEventListener`), so node runs need a minimal `window`
 * stand-in. The shim is intentionally tiny: anything not listed here
 * (localStorage, location, matchMedia, …) stays undefined so the
 * `typeof window !== "undefined"` fallbacks in the source keep behaving
 * exactly like they do without a window. Browser test runs are unaffected —
 * they either have a real `window` or run a different vitest project.
 */

type ShimListener = (event?: unknown) => void;

const shimListeners = new Map<string, Set<ShimListener>>();

if (typeof globalThis.window === "undefined") {
  const shim = {
    addEventListener(type: string, handler: ShimListener): void {
      let byType = shimListeners.get(type);
      if (!byType) {
        byType = new Set<ShimListener>();
        shimListeners.set(type, byType);
      }
      byType.add(handler);
    },
    removeEventListener(type: string, handler: ShimListener): void {
      shimListeners.get(type)?.delete(handler);
    },
    setTimeout(handler: () => void, delay?: number): number {
      return globalThis.setTimeout(handler, delay) as unknown as number;
    },
    clearTimeout(timer: number | undefined): void {
      if (timer !== undefined) {
        globalThis.clearTimeout(timer);
      }
    },
    // Matches the no-window default in views/overview.ts's secure-context
    // check so guarded reads behave the same with and without the shim.
    isSecureContext: true,
  };
  globalThis.window = shim as unknown as typeof globalThis.window;
}
