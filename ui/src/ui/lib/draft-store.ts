/**
 * Minimal IndexedDB-backed composer draft store.
 *
 * Borrowed concept from the 9.2 control UI's composer-draft-store.runtime.ts:
 * persist unsent composer text per `<agentScope>|<sessionKey>` so a reload or
 * session switch does not lose a half-written message. This is a compact
 * rewrite with no external dependencies.
 *
 * Hard rules: IndexedDB can be missing or broken (private mode, quota,
 * disabled) and can throw synchronously. Every export is async and resolves to
 * a safe sentinel instead of throwing or rejecting — drafts must never break
 * chat.
 */

const DB_NAME = "paleoclaw-control-ui";
const DB_VERSION = 1;
const DRAFT_STORE = "drafts";

let dbPromise: Promise<IDBDatabase | null> | null = null;

/** Module-level availability probe. Safe to call repeatedly; never throws. */
export function isDraftStoreAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb request failed"));
  });
}

function transactionAsPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("indexeddb transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("indexeddb transaction aborted"));
  });
}

/** Opens (once) and caches the draft database. Resolves null when unavailable. */
function openDatabase(): Promise<IDBDatabase | null> {
  if (!isDraftStoreAvailable()) {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch {
        dbPromise = null; // Retry the open on the next call.
        resolve(null);
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DRAFT_STORE)) {
          db.createObjectStore(DRAFT_STORE);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        // Another tab upgraded the schema: release this connection and let the
        // next call reopen against the new version.
        db.onversionchange = () => {
          dbPromise = null;
          try {
            db.close();
          } catch {
            /* Already closed. */
          }
        };
        resolve(db);
      };
      // Failure paths must forget the memoized promise, or one transient
      // failure (private mode, quota, blocked upgrade) would disable drafts
      // for the rest of the page's lifetime.
      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
      request.onblocked = () => {
        dbPromise = null;
        resolve(null);
      };
    }).catch(() => {
      dbPromise = null;
      return null;
    });
  }
  return dbPromise;
}

/**
 * Runs `run` inside a readwrite transaction on the draft store. Resolves true
 * on commit, false on any failure (open, sync throw, abort) — never rejects.
 */
async function withDraftStore(
  run: (store: IDBObjectStore) => void | Promise<void>,
): Promise<boolean> {
  try {
    const db = await openDatabase();
    if (!db) {
      return false;
    }
    const transaction = db.transaction(DRAFT_STORE, "readwrite");
    try {
      await run(transaction.objectStore(DRAFT_STORE));
    } catch (err) {
      try {
        transaction.abort();
      } catch {
        /* Transaction already settled. */
      }
      throw err;
    }
    await transactionAsPromise(transaction);
    return true;
  } catch {
    return false;
  }
}

/** Loads the draft text for a composite key. Resolves "" when missing/unavailable. */
export async function loadDraft(key: string): Promise<string> {
  const normalizedKey = typeof key === "string" ? key : "";
  if (!normalizedKey) {
    return "";
  }
  try {
    const db = await openDatabase();
    if (!db) {
      return "";
    }
    const transaction = db.transaction(DRAFT_STORE, "readonly");
    const value: unknown = await requestAsPromise(
      transaction.objectStore(DRAFT_STORE).get(normalizedKey),
    );
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

/** Persists the draft text for a composite key. Resolves when best-effort done. */
export async function saveDraft(key: string, text: string): Promise<void> {
  const normalizedKey = typeof key === "string" ? key : "";
  if (!normalizedKey || typeof text !== "string") {
    return;
  }
  await withDraftStore((store) => {
    store.put(text, normalizedKey);
  });
}

/** Removes the draft for a composite key. Resolves when best-effort done. */
export async function clearDraft(key: string): Promise<void> {
  const normalizedKey = typeof key === "string" ? key : "";
  if (!normalizedKey) {
    return;
  }
  await withDraftStore((store) => {
    store.delete(normalizedKey);
  });
}
