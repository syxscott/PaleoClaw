import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Resolve the PaleoClaw home directory.
 * Uses PALEOCLAW_HOME env var if set, otherwise defaults to ~/.paleoclaw.
 */
export function paleoclawHome(): string {
  return process.env.PALEOCLAW_HOME || path.join(os.homedir(), '.paleoclaw');
}

/**
 * Atomic file write: write to temp then rename (POSIX rename is atomic).
 * Readers never see a half-written file even if the process crashes.
 */
export function atomicWriteFile(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, filePath);
}

/**
 * Create a directory restricted to the current user (mode 0o700 on POSIX;
 * ignored on Windows). Borrowed from OpenClaw's private-file-store semantics:
 * session/memory/credential state must never be world-readable. Existing
 * directories are left as-is so repeated calls never loosen permissions.
 */
export function ensurePrivateDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  }
}
