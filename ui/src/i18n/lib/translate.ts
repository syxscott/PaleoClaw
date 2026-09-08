import { en } from "../locales/en.ts";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  loadLazyLocaleTranslation,
  resolveNavigatorLocale,
} from "./registry.ts";
import type { Locale, TranslationMap } from "./types.ts";

type Subscriber = (locale: Locale) => void;

export { SUPPORTED_LOCALES, isSupportedLocale };

class I18nManager {
  private locale: Locale = DEFAULT_LOCALE;
  private translations: Partial<Record<Locale, TranslationMap>> = { [DEFAULT_LOCALE]: en };
  private subscribers: Set<Subscriber> = new Set();
  // Hardening (adapted from the 9.2 control UI): only the latest setLocale
  // request may commit after its async chunk load, and a locale whose load
  // failed stays "pending" so it can be retried instead of silently sticking
  // to the previous language.
  private localeRequestGeneration = 0;
  private pendingLocale: Locale | null = null;
  /** Set when a load failed; lets the next t() call retry exactly once. */
  private pendingLocaleAutoRetryArmed = false;

  constructor() {
    this.loadLocale();
  }

  private readStoredLocale(): string | null {
    try {
      return localStorage.getItem("paleoclaw.i18n.locale");
    } catch {
      // Storage can throw in private/blocked contexts.
      return null;
    }
  }

  private persistLocale(locale: Locale) {
    try {
      localStorage.setItem("paleoclaw.i18n.locale", locale);
    } catch {
      // Ignore storage write failures; the in-memory locale still applies.
    }
  }

  private resolveInitialLocale(): Locale {
    const saved = this.readStoredLocale();
    if (isSupportedLocale(saved)) {
      return saved;
    }
    return resolveNavigatorLocale(navigator.language);
  }

  private loadLocale() {
    const initialLocale = this.resolveInitialLocale();
    if (initialLocale === DEFAULT_LOCALE) {
      this.locale = DEFAULT_LOCALE;
      return;
    }
    // Use the normal locale setter so startup locale loading follows the same
    // translation-loading + notify path as manual locale changes.
    void this.setLocale(initialLocale);
  }

  public getLocale(): Locale {
    return this.locale;
  }

  public async setLocale(locale: Locale) {
    await this.requestLocale(locale);
  }

  /**
   * Single locale-load pipeline. `fromRetry` marks requests issued by
   * retryPendingLocale (t()-driven or reconnect hook): a retry that fails
   * again must NOT re-arm the auto-retry, or every t() call would fire a new
   * locale import() forever.
   */
  private async requestLocale(locale: Locale, opts?: { fromRetry?: boolean }) {
    const fromRetry = opts?.fromRetry === true;
    const requestGeneration = ++this.localeRequestGeneration;
    const needsTranslationLoad = locale !== DEFAULT_LOCALE && !this.translations[locale];
    if (this.locale === locale && !needsTranslationLoad) {
      this.pendingLocale = null;
      return;
    }

    if (needsTranslationLoad) {
      this.pendingLocale = locale;
      try {
        const translation = await loadLazyLocaleTranslation(locale);
        // A newer locale selection superseded this request: discard the stale
        // load so rapid switching can never let an older chunk win.
        if (requestGeneration !== this.localeRequestGeneration) {
          return;
        }
        if (!translation) {
          return; // Stays pending for retryPendingLocale().
        }
        this.translations[locale] = translation;
      } catch (e) {
        if (requestGeneration === this.localeRequestGeneration) {
          this.pendingLocale = locale;
          // Arm exactly one t()-driven retry; after that only the exported
          // retry hook (or another setLocale) re-attempts. Retry-originated
          // failures are exempt — see requestLocale docs above.
          if (!fromRetry) {
            this.pendingLocaleAutoRetryArmed = true;
          }
        }
        console.error(`Failed to load locale: ${locale}`, e);
        return;
      }
    }

    if (requestGeneration !== this.localeRequestGeneration) {
      return;
    }
    this.pendingLocale = null;
    this.pendingLocaleAutoRetryArmed = false;
    this.locale = locale;
    this.persistLocale(locale);
    this.notify();
  }

  /**
   * Retries the locale whose lazy load failed earlier (e.g. a gateway hiccup
   * while fetching the chunk). Safe to call anytime; no-op when nothing is
   * pending. Also exposed as a hook for "gateway reconnected" handlers.
   */
  public retryPendingLocale(): void {
    const target = this.pendingLocale;
    if (target === null || target === this.locale) {
      return;
    }
    void this.requestLocale(target, { fromRetry: true });
  }

  private retryPendingLocaleOnce() {
    if (!this.pendingLocaleAutoRetryArmed || this.pendingLocale === null) {
      return;
    }
    this.pendingLocaleAutoRetryArmed = false;
    this.retryPendingLocale();
  }

  public registerTranslation(locale: Locale, map: TranslationMap) {
    this.translations[locale] = map;
  }

  public subscribe(sub: Subscriber) {
    this.subscribers.add(sub);
    return () => this.subscribers.delete(sub);
  }

  private notify() {
    this.subscribers.forEach((sub) => sub(this.locale));
  }

  /**
   * Never throws and always returns a string: requested locale → English →
   * the raw key. Any unexpected failure resolves to the raw key.
   */
  public t(key: string, params?: Record<string, string>): string {
    try {
      // A locale load failed earlier? Give it exactly one more shot on the
      // next translate call before falling back (English → key).
      this.retryPendingLocaleOnce();
      return this.translate(key, params);
    } catch {
      return key;
    }
  }

  private translate(key: string, params?: Record<string, string>): string {
    const keys = key.split(".");
    let value: unknown = this.translations[this.locale] || this.translations[DEFAULT_LOCALE];

    for (const k of keys) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[k];
      } else {
        value = undefined;
        break;
      }
    }

    // Fallback to English.
    if (value === undefined && this.locale !== DEFAULT_LOCALE) {
      value = this.translations[DEFAULT_LOCALE];
      for (const k of keys) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[k];
        } else {
          value = undefined;
          break;
        }
      }
    }

    if (typeof value !== "string") {
      return key;
    }

    if (params) {
      // ?? not ||: an empty-string param is a provided value (render empty),
      // while a missing param keeps the visible {placeholder} for debugging.
      return value.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
    }

    return value;
  }
}

export const i18n = new I18nManager();
export const t = (key: string, params?: Record<string, string>) => i18n.t(key, params);
/** Exported retry hook for the pending locale (e.g. call on gateway reconnect). */
export const retryPendingLocale = () => i18n.retryPendingLocale();
