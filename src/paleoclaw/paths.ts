import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * Resolve the PaleoClaw home directory.
 * Uses PALEOCLAW_HOME env var if set, otherwise defaults to ~/.paleoclaw.
 */
export function paleoclawHome(): string {
  return process.env.PALEOCLAW_HOME || path.join(os.homedir(), ".paleoclaw");
}

/**
 * Atomic file write: write to temp then rename (POSIX rename is atomic).
 * Readers never see a half-written file even if the process crashes.
 */
export function atomicWriteFile(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, filePath);
}

/**
 * Create a directory restricted to the current user (mode 0o700 on POSIX;
 * ignored on Windows). Borrowed from paleoclaw's private-file-store semantics:
 * session/memory/credential state must never be world-readable. Existing
 * directories are left as-is so repeated calls never loosen permissions.
 */
export function ensurePrivateDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  }
}

/**
 * Lock behaviour: how long to wait for a busy lock, and when a lock file is
 * considered abandoned (e.g. the writer crashed) and may be broken.
 */
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_STALE_MS = 30_000;

/**
 * Path of the lock file that serializes updates to one data file.
 */
export function fileLockPath(filePath: string): string {
  return `${filePath}.lock`;
}

/**
 * Block the current thread for `ms` without burning CPU. Used by the file
 * lock, which is a synchronous critical section.
 */
function sleepSync(ms: number): void {
  const shared = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(shared, 0, 0, ms);
}

/**
 * Run `fn` while holding the exclusive lock for `filePath`.
 *
 * The lock is a sibling `<file>.lock` file created with O_EXCL, so it is
 * honoured across processes (not just across threads). A lock left behind by
 * a crashed writer is broken after LOCK_STALE_MS; if the lock cannot be taken
 * within LOCK_TIMEOUT_MS the write still proceeds — the file write itself
 * stays atomic, so the worst case is a lost update, never a half-written file.
 *
 * Use this around any read-modify-write against a shared JSON file: without
 * it two processes read the same base state and the later writer drops the
 * earlier change.
 */
export function withFileLock<T>(filePath: string, fn: () => T): T {
  const lockPath = fileLockPath(filePath);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let handle: number | null = null;

  while (handle === null) {
    try {
      handle = fs.openSync(lockPath, "wx");
    } catch {
      try {
        const stat = fs.statSync(lockPath);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          // Abandoned lock — break it and retry.
          fs.rmSync(lockPath, { force: true });
          continue;
        }
      } catch {
        // The lock disappeared between the failed open and the stat.
        continue;
      }
      if (Date.now() >= deadline) {
        // Timed out waiting for the lock: proceed unserialized rather than
        // dropping the write.
        break;
      }
      sleepSync(5);
    }
  }

  try {
    return fn();
  } finally {
    if (handle !== null) {
      try {
        fs.closeSync(handle);
      } catch {
        // ignore
      }
      try {
        fs.rmSync(lockPath, { force: true });
      } catch {
        // ignore
      }
    }
  }
}
