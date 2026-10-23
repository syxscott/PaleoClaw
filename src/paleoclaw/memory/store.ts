/**
 * PaleoClaw Memory Store - Short-term and long-term memory management
 * Adapted from GeoClaw-OpenAI v2.4.0
 */

import * as fs from "fs";
import * as path from "path";
import {
  paleoclawHome,
  atomicWriteFile,
  ensurePrivateDir,
  fileLockPath,
  withFileLock,
} from "../paths.js";
import { SessionProfile, loadSessionProfile, memoryContext } from "../profile/layers.js";
import { bestMatches, SearchItem } from "./retrieval.js";

// Task memory interfaces
export interface TaskMemory {
  taskId: string;
  command: string;
  argv: string[];
  cwd: string;
  status: "running" | "success" | "failed";
  returnCode: number | null;
  error: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string;
  promoted: boolean;
  review: ReviewData;
  profileSnapshot: Record<string, unknown>;
  extra?: Record<string, unknown>;
}

export interface ReviewData {
  reviewedAt?: string;
  summary?: string;
  lessons?: string[];
  nextActions?: string[];
}

export interface LongTermMemory {
  taskId: string;
  command: string;
  argv: string[];
  cwd: string;
  status: string;
  returnCode: number | null;
  createdAt: string;
  finishedAt: string;
  reviewedAt: string;
  summary: string;
  lessons: string[];
  nextActions: string[];
}

export interface ArchiveResult {
  moved: number;
  skipped: number;
  beforeDays: number;
  statusFilter: string;
  archiveDir: string;
  archivedTaskIds: string[];
}

// Chat day-file shapes, ported from GeoClaw's chat_daily feature. The
// chat_digest field names deliberately mirror GeoClaw's on-disk format.
export interface ChatTurnRecord {
  ts: string;
  user: string;
  assistant: string;
}

export interface ChatDigest {
  turn_count: number;
  first_turn_at: string;
  last_turn_at: string;
  intents: string[];
  modes: string[];
  recent_turns: ChatTurnRecord[];
}

export interface ChatDailyRecord {
  sessionId: string;
  day: string;
  chat_digest: ChatDigest;
}

function utcNow(): string {
  return new Date().toISOString();
}

// Monotonic counter eliminates same-millisecond collisions that would
// otherwise cause writeShort to silently overwrite an existing task.
let _taskCounter = 0;

function generateTaskId(): string {
  const stamp = Date.now().toString(36); // millisecond precision
  const rand = Math.random().toString(36).substring(2, 8);
  const seq = (_taskCounter++).toString(36);
  return `${stamp}-${seq}-${rand}`;
}

function emptyChatDigest(): ChatDigest {
  return {
    turn_count: 0,
    first_turn_at: "",
    last_turn_at: "",
    intents: [],
    modes: [],
    recent_turns: [],
  };
}

/**
 * Clip text to maxChars code points (not UTF-16 code units) so CJK-heavy
 * content and emoji never split a surrogate pair. Ported from GeoClaw's
 * _clip_text (default 240 chars, '...' suffix on overflow).
 */
export function clipText(text: string, maxChars = 240): string {
  const value = (text || "").trim();
  const chars = Array.from(value);
  if (chars.length <= maxChars) {
    return value;
  }
  return `${chars.slice(0, Math.max(1, maxChars - 3)).join("")}...`;
}

/**
 * Sanitize a session id for use inside a filename. Ported from GeoClaw's
 * _safe_session_key: keep [A-Za-z0-9_.-], collapse every other run of
 * characters into '_', trim leading/trailing separators, cap the length and
 * fall back to 'adhoc' when nothing is left.
 */
function safeSessionKey(raw: string): string {
  let text = (raw || "")
    .toString()
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_");
  text = text.replace(/^[._-]+|[._-]+$/g, "");
  // Cap over-long ids so day-file names stay filesystem friendly.
  if (text.length > 64) {
    text = text.slice(0, 64).replace(/^[._-]+|[._-]+$/g, "");
  }
  return text || "adhoc";
}

/**
 * Parse a timestamp into a Date. Accepts ISO strings, epoch numbers and Date
 * objects; empty or invalid input falls back to now. Ported from GeoClaw's
 * _parse_event_time, including its treatment of offset-less ISO date-times
 * as UTC rather than local time.
 */
function parseEventTime(raw?: string | number | Date): Date {
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? new Date() : raw;
  }
  if (typeof raw === "number") {
    const fromEpoch = new Date(raw);
    return Number.isNaN(fromEpoch.getTime()) ? new Date() : fromEpoch;
  }
  const text = (raw || "").toString().trim();
  if (!text) {
    return new Date();
  }
  let candidate = text;
  if (/[zZ]$/.test(candidate)) {
    candidate = `${candidate.slice(0, -1)}+00:00`;
  } else if (
    !/(?:[+-]\d{2}:?\d{2})$/.test(candidate) &&
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(candidate)
  ) {
    candidate = `${candidate.replace(" ", "T")}Z`;
  }
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/** UTC day key (YYYYMMDD) used in chat day-file names. */
function chatDayKey(event: Date): string {
  return event.toISOString().slice(0, 10).replace(/-/g, "");
}

/** Chat day-file name pattern: chat-YYYYMMDD-<safeSessionId>.json */
const CHAT_DAY_FILE_RE = /^chat-(\d{8})-.+\.json$/;

/**
 * Parse a YYYYMMDD day key into calendar parts, or null when the key is not
 * a real calendar date (e.g. "99999999" or "20260230").
 */
function parseDayKey(dayKey: string): { year: number; month: number; day: number } | null {
  if (!/^\d{8}$/.test(dayKey)) {
    return null;
  }
  const year = Number(dayKey.slice(0, 4));
  const month = Number(dayKey.slice(4, 6));
  const day = Number(dayKey.slice(6, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const stamp = Date.UTC(year, month - 1, day);
  if (!Number.isFinite(stamp)) {
    return null;
  }
  const back = new Date(stamp);
  if (
    back.getUTCFullYear() !== year ||
    back.getUTCMonth() !== month - 1 ||
    back.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/** Shift a YYYYMMDD day key by whole days (negative shifts into the past). */
function shiftDayKey(dayKey: string, deltaDays: number): string {
  const parts = parseDayKey(dayKey);
  if (!parts) {
    return dayKey;
  }
  const shifted = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day) + deltaDays * 86_400_000,
  );
  return shifted.toISOString().slice(0, 10).replace(/-/g, "");
}

// Retention for chat day digests: files older than this are swept when a new
// turn is written. Chat digests are conversation history rather than task
// memories, so archiveShort deliberately skips them — without a retention
// window they would accumulate on disk forever.
const CHAT_RETENTION_DAYS = 90;
// Retrieval window (calendar days) and item cap for the chat corpus.
const CHAT_RETRIEVAL_WINDOW_DAYS = 30;
const CHAT_RETRIEVAL_MAX_ITEMS = 30;
// How long a lock file is considered abandoned (e.g. the writer crashed) and
// may be broken. The wait timeout itself lives in the shared `withFileLock`
// primitive in `paths.ts`.
const CHAT_LOCK_STALE_MS = 30_000;

/**
 * Path of the lock file that serializes updates to one chat day file.
 * Exported so callers/tests can reason about the same convention.
 */
export function chatDayLockPath(filePath: string): string {
  return fileLockPath(filePath);
}

/**
 * Chat day files (`chat-YYYYMMDD-<safeSessionId>.json`) live in the same
 * directory as task memories but hold a ChatDailyRecord, not a TaskMemory.
 * They are conversation digests, never task entries, so every task-shaped
 * reader must skip them — otherwise counts inflate, listings render rows of
 * `undefined`, and search feeds a constant string into the ranker.
 */
function isChatDayFile(name: string): boolean {
  return name.startsWith("chat-") && name.endsWith(".json");
}

/** Task memories are the only `.json` files in shortDir that are not chat digests. */
function isTaskFile(name: string): boolean {
  return name.endsWith(".json") && !isChatDayFile(name);
}

/**
 * Shape guard for on-disk task records. A file can be valid JSON and still
 * not be a TaskMemory (chat digests, stray backups, truncated writes), so
 * listing paths must verify the discriminator before treating a row as a task.
 */
function isTaskMemoryShape(value: unknown): value is TaskMemory {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<TaskMemory>;
  return (
    typeof candidate.taskId === "string" &&
    candidate.taskId.length > 0 &&
    typeof candidate.command === "string"
  );
}

/**
 * Normalize a caller-supplied row limit.
 *
 * The two list paths previously disagreed on garbage input: `rows.slice(0,
 * NaN)` yields `[]` (silently empty) while `rows.length >= NaN` is never
 * true (silently *everything*). A negative limit is just as bad — `slice(0,
 * -1)` drops the newest rows instead of clamping. Normalizing once here makes
 * every list path behave identically; the CLI still rejects bad input up
 * front with a message.
 */
function normalizeLimit(value: number | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

export class TaskMemoryStore {
  private root: string;
  private shortDir: string;
  private archiveShortDir: string;
  private longFile: string;
  private sessionProfile: SessionProfile | null;

  constructor(sessionProfile?: SessionProfile) {
    this.root = path.join(paleoclawHome(), "memory");
    this.shortDir = path.join(this.root, "short");
    this.archiveShortDir = path.join(this.root, "archive", "short");
    this.longFile = path.join(this.root, "long_term.jsonl");
    this.sessionProfile = sessionProfile || null;

    if (!this.sessionProfile) {
      try {
        this.sessionProfile = loadSessionProfile();
      } catch {
        this.sessionProfile = null;
      }
    }

    this.ensurePaths();
  }

  private ensurePaths(): void {
    if (!fs.existsSync(this.shortDir)) {
      ensurePrivateDir(this.shortDir);
    }
    if (!fs.existsSync(this.archiveShortDir)) {
      ensurePrivateDir(this.archiveShortDir);
    }
    if (!fs.existsSync(path.dirname(this.longFile))) {
      ensurePrivateDir(path.dirname(this.longFile));
    }
    if (!fs.existsSync(this.longFile)) {
      fs.writeFileSync(this.longFile, "", "utf-8");
    }
  }

  private shortPath(taskId: string): string {
    return path.join(this.shortDir, `${taskId}.json`);
  }

  private readShort(taskId: string): TaskMemory {
    const filePath = this.shortPath(taskId);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Short memory task not found: ${taskId}`);
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as TaskMemory;
  }

  private writeShort(taskId: string, payload: TaskMemory): void {
    const filePath = this.shortPath(taskId);
    atomicWriteFile(filePath, JSON.stringify(payload, null, 2));
  }

  private buildReview(task: TaskMemory): ReviewData {
    const command = task.command || "task";
    const status = task.status;
    const returnCode = task.returnCode;
    const error = task.error || "";

    let summary: string;
    let lessons: string[];
    let nextActions: string[];

    if (status === "success") {
      summary = `Command '${command}' completed successfully.`;
      lessons = ["Current parameters and environment are runnable and reproducible."];
      nextActions = ["Keep output artifacts and logs for future comparison."];
    } else {
      summary = `Command '${command}' failed with return code ${returnCode}.`;
      lessons = ["Failure information has been captured in short-term memory."];
      nextActions = ["Check CLI output and rerun after fixing environment or parameters."];
      if (error) {
        nextActions.push(`Primary error: ${error}`);
      }
    }

    // Add profile context
    const profileCtx = this.memoryProfileSnapshot();
    const repro = (profileCtx.reproducibilityExpectations as string[]) || [];
    const constraints = (profileCtx.longTermConstraints as string[]) || [];

    if (Array.isArray(repro)) {
      for (const item of repro.slice(0, 2)) {
        lessons.push(`Profile reproducibility expectation: ${item}`);
      }
    }

    if (status !== "success" && Array.isArray(constraints)) {
      for (const item of constraints.slice(0, 2)) {
        nextActions.push(`Profile long-term constraint reminder: ${item}`);
      }
    }

    return {
      reviewedAt: utcNow(),
      summary,
      lessons,
      nextActions,
    };
  }

  private buildSearchText(payload: TaskMemory | LongTermMemory, source: string): string {
    const parts: string[] = [
      source,
      payload.taskId,
      payload.command,
      (payload.argv || []).join(" "),
      payload.status,
      (payload as TaskMemory).error || "",
      (payload as LongTermMemory).summary || "",
    ];

    const review = (payload as TaskMemory).review;
    if (review && typeof review === "object") {
      parts.push(review.summary || "");
      parts.push(...(review.lessons || []));
      parts.push(...(review.nextActions || []));
    }

    parts.push(...((payload as LongTermMemory).lessons || []));
    parts.push(...((payload as LongTermMemory).nextActions || []));

    const snapshot = (payload as TaskMemory).profileSnapshot;
    if (snapshot && typeof snapshot === "object") {
      parts.push(typeof snapshot.userRole === "string" ? snapshot.userRole : "");
      parts.push(typeof snapshot.preferredTone === "string" ? snapshot.preferredTone : "");
      parts.push(...((snapshot.reproducibilityExpectations as string[]) || []));
      parts.push(...((snapshot.truthfulnessRules as string[]) || []));
    }

    return parts.filter((x) => x && x.trim()).join("\n");
  }

  /**
   * Search text for a chat day digest. Chat records are not TaskMemory-shaped,
   * so they must never go through buildSearchText() — that would index only the
   * constant source label and make every digest a permanent match for the word
   * "short". Index the actual turn content instead, plus the intents/modes
   * recorded for the day.
   */
  private buildChatSearchText(record: ChatDailyRecord): string {
    const digest = record?.chat_digest;
    if (!digest || typeof digest !== "object") {
      return "";
    }
    const parts: string[] = [
      "chat",
      record.sessionId || "",
      record.day || "",
      ...(Array.isArray(digest.intents) ? digest.intents : []),
      ...(Array.isArray(digest.modes) ? digest.modes : []),
    ];
    for (const turn of Array.isArray(digest.recent_turns) ? digest.recent_turns : []) {
      if (!turn || typeof turn !== "object") {
        continue;
      }
      parts.push(turn.user || "", turn.assistant || "");
    }
    return parts.filter((x) => x && x.trim()).join("\n");
  }

  private memoryProfileSnapshot(): Record<string, unknown> {
    if (!this.sessionProfile) {
      return {};
    }
    return memoryContext(this.sessionProfile);
  }

  // Public API
  startTask(command: string, argv: string[], cwd: string): string {
    const taskId = generateTaskId();
    const payload: TaskMemory = {
      taskId,
      command,
      argv: [...argv],
      cwd,
      status: "running",
      returnCode: null,
      error: "",
      createdAt: utcNow(),
      updatedAt: utcNow(),
      finishedAt: "",
      promoted: false,
      review: {},
      profileSnapshot: this.memoryProfileSnapshot(),
    };
    this.writeShort(taskId, payload);
    return taskId;
  }

  finishTask(
    taskId: string,
    returnCode: number,
    error = "",
    extra?: Record<string, unknown>,
  ): TaskMemory {
    const payload = this.readShort(taskId);
    payload.status = returnCode === 0 ? "success" : "failed";
    payload.returnCode = returnCode;
    payload.error = error.trim();
    payload.finishedAt = utcNow();
    payload.updatedAt = utcNow();

    if (extra) {
      payload.extra = { ...payload.extra, ...extra };
    }

    this.writeShort(taskId, payload);
    return payload;
  }

  /**
   * Run `fn` while holding the exclusive lock for `filePath`.
   *
   * Delegates to the shared primitive in `paths.ts` so the memory store and
   * the JSON session store use the same cross-process lock convention.
   */
  private withChatFileLock<T>(filePath: string, fn: () => T): T {
    return withFileLock(filePath, fn);
  }

  /**
   * Fold one chat turn into the session's day file
   * (chat-YYYYMMDD-<safeSessionId>.json in the short-term dir). Only a
   * rolling digest is kept — recent_turns holds at most the last 8 turns
   * (user text clipped to 160 chars, assistant to 200, as in GeoClaw) and
   * intents/modes the last 10 distinct values — so full transcripts are
   * never persisted. Ported from GeoClaw's record_chat_turn.
   *
   * The read-merge-write runs under an exclusive lock: without it two
   * processes writing the same (day, session) would both read the same base
   * digest and the later writer would drop the earlier turn.
   */
  recordChatTurn(input: {
    sessionId: string;
    userText: string;
    assistantText: string;
    intent?: string;
    mode?: string;
    ts?: string;
  }): void {
    const event = parseEventTime(input.ts);
    const day = chatDayKey(event);
    const sid = safeSessionKey(input.sessionId);
    const filePath = this.shortPath(`chat-${day}-${sid}`);
    const nowIso = event.toISOString();
    const intent = input.intent || "chat";
    const mode = input.mode || "fallback";

    this.withChatFileLock(filePath, () => {
      let record: ChatDailyRecord | null = null;
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as ChatDailyRecord;
        if (parsed && typeof parsed === "object") {
          record = parsed;
        }
      } catch {
        // Missing or corrupt day file: start a fresh digest (GeoClaw behavior).
        record = null;
      }

      if (!record) {
        record = { sessionId: sid, day, chat_digest: emptyChatDigest() };
      }
      record.sessionId = sid;
      record.day = day;

      const digest =
        record.chat_digest && typeof record.chat_digest === "object"
          ? record.chat_digest
          : emptyChatDigest();

      digest.turn_count = (Number(digest.turn_count) || 0) + 1;
      digest.last_turn_at = nowIso;
      if (!digest.first_turn_at) {
        digest.first_turn_at = nowIso;
      }

      const intents = (digest.intents || []).map((x) => String(x).trim()).filter((x) => x);
      if (intent && !intents.includes(intent)) {
        intents.push(intent);
      }
      digest.intents = intents.slice(-10);

      const modes = (digest.modes || []).map((x) => String(x).trim()).filter((x) => x);
      if (mode && !modes.includes(mode)) {
        modes.push(mode);
      }
      digest.modes = modes.slice(-10);

      const turns = (digest.recent_turns || []).filter((x) => x && typeof x === "object");
      turns.push({
        ts: nowIso,
        user: clipText(input.userText, 160),
        assistant: clipText(input.assistantText, 200),
      });
      digest.recent_turns = turns.slice(-8);

      record.chat_digest = digest;
      // Chat day files are not TaskMemory-shaped, so write via atomicWriteFile
      // directly instead of writeShort.
      atomicWriteFile(filePath, JSON.stringify(record, null, 2));
    });

    // Retention sweep: chat digests are never archived, so old ones are
    // removed here. The file we just wrote is always kept.
    try {
      this.purgeChatDaily({ beforeDays: CHAT_RETENTION_DAYS, keepPath: filePath });
    } catch {
      // Retention is best-effort — never fail a turn because of it.
    }
  }

  /**
   * Delete chat day files whose day is older than `beforeDays` days.
   *
   * Chat digests are conversation history rather than task memories, so
   * archiveShort deliberately skips them; without this sweep they would
   * accumulate on disk forever. Task memories are never touched.
   *
   * `keepPath` protects a single file (e.g. the digest that was just
   * written) from being swept by the write that triggered the sweep.
   */
  purgeChatDaily(options: { beforeDays?: number; keepPath?: string } = {}): {
    removed: number;
    kept: number;
    beforeDays: number;
    cutoffDay: string;
  } {
    const requested = Math.floor(Number(options.beforeDays));
    const beforeDays =
      Number.isFinite(requested) && requested >= 0 ? requested : CHAT_RETENTION_DAYS;
    const cutoffDay = shiftDayKey(chatDayKey(new Date()), -beforeDays);

    let files: string[] = [];
    try {
      files = fs.readdirSync(this.shortDir);
    } catch {
      return { removed: 0, kept: 0, beforeDays, cutoffDay };
    }

    // Abandoned locks from a crashed writer are dropped once they are stale.
    // They are not chat digests, so they are not counted in the result.
    for (const file of files) {
      if (!file.endsWith(".lock")) {
        continue;
      }
      try {
        const stat = fs.statSync(path.join(this.shortDir, file));
        if (Date.now() - stat.mtimeMs > CHAT_LOCK_STALE_MS) {
          fs.rmSync(path.join(this.shortDir, file), { force: true });
        }
      } catch {
        // ignore
      }
    }

    let removed = 0;
    let kept = 0;
    for (const file of files) {
      const filePath = path.join(this.shortDir, file);
      if (!CHAT_DAY_FILE_RE.test(file)) {
        continue;
      }
      if (options.keepPath && path.resolve(filePath) === path.resolve(options.keepPath)) {
        kept++;
        continue;
      }
      const fileDay = CHAT_DAY_FILE_RE.exec(file)?.[1] ?? "";
      if (!parseDayKey(fileDay) || fileDay >= cutoffDay) {
        kept++;
        continue;
      }
      try {
        fs.rmSync(filePath, { force: true });
        removed++;
      } catch {
        kept++;
      }
    }

    return { removed, kept, beforeDays, cutoffDay };
  }

  /**
   * List chat day digests within the last `days` calendar days, newest first.
   *
   * `days` is a real date window: the window ends on the newest day present
   * in the store (not on the wall clock), so the result never depends on when
   * the caller runs. The previous implementation capped the *number of files*
   * instead, which silently shrank the recall window as soon as a store held
   * more sessions than days. Corrupt files are skipped.
   */
  listChatDaily(days = 7): ChatDailyRecord[] {
    const rows: ChatDailyRecord[] = [];
    const requested = Math.floor(Number(days));
    const windowDays = Number.isFinite(requested) ? Math.max(1, requested) : 7;

    let files: string[] = [];
    try {
      files = fs
        .readdirSync(this.shortDir)
        .filter((f) => CHAT_DAY_FILE_RE.test(f))
        .toSorted()
        .toReversed();
    } catch {
      return rows;
    }
    if (files.length === 0) {
      return rows;
    }

    // Files are sorted newest-first, so the first one with a real calendar
    // day anchors the window.
    let anchorDay = "";
    for (const file of files) {
      const candidate = CHAT_DAY_FILE_RE.exec(file)?.[1] ?? "";
      if (parseDayKey(candidate)) {
        anchorDay = candidate;
        break;
      }
    }
    if (!anchorDay) {
      return rows;
    }
    const cutoff = shiftDayKey(anchorDay, -(windowDays - 1));

    for (const file of files) {
      const fileDay = CHAT_DAY_FILE_RE.exec(file)?.[1] ?? "";
      if (!parseDayKey(fileDay)) {
        continue; // not a real calendar day — ignore the file entirely
      }
      if (fileDay < cutoff) {
        break; // files are newest-first, so everything left is older
      }
      try {
        const content = fs.readFileSync(path.join(this.shortDir, file), "utf-8");
        const parsed = JSON.parse(content) as ChatDailyRecord;
        if (!parsed || typeof parsed !== "object" || !parsed.chat_digest) {
          continue;
        }
        rows.push(parsed);
      } catch {
        // Skip invalid files
      }
    }

    return rows;
  }

  /**
   * Read the digest of one chat day file for a YYYYMMDD key. When several
   * sessions chatted that day, the lexicographically last session file wins.
   * Returns null when the day file is missing or corrupt.
   */
  getChatDailyDigest(day: string): ChatDigest | null {
    const normalized = (day || "").toString().trim();
    if (!/^\d{8}$/.test(normalized)) {
      return null;
    }
    let files: string[] = [];
    try {
      files = fs
        .readdirSync(this.shortDir)
        .filter((f) => f.startsWith(`chat-${normalized}-`) && f.endsWith(".json"))
        .toSorted();
    } catch {
      return null;
    }
    if (files.length === 0) {
      return null;
    }
    try {
      const file = files[files.length - 1];
      const content = fs.readFileSync(path.join(this.shortDir, file), "utf-8");
      const parsed = JSON.parse(content) as ChatDailyRecord;
      if (!parsed || typeof parsed !== "object" || !parsed.chat_digest) {
        return null;
      }
      return parsed.chat_digest;
    } catch {
      return null;
    }
  }

  autoReviewToLong(taskId: string): LongTermMemory {
    const task = this.readShort(taskId);
    // Refuse to promote a task that has not finished yet — a running task
    // has returnCode=null / finishedAt='' and would write dirty long-term data.
    if (task.status === "running" || !task.finishedAt) {
      throw new Error(
        `Cannot review task ${taskId}: task has not finished (status=${task.status}).`,
      );
    }
    // Guard against double-promotion producing duplicate long-term records.
    if (task.promoted) {
      throw new Error(`Task ${taskId} has already been promoted to long-term memory.`);
    }
    const review = this.buildReview(task);

    const longPayload: LongTermMemory = {
      taskId: task.taskId,
      command: task.command,
      argv: task.argv,
      cwd: task.cwd,
      status: task.status,
      returnCode: task.returnCode,
      createdAt: task.createdAt,
      finishedAt: task.finishedAt,
      reviewedAt: review.reviewedAt || utcNow(),
      summary: review.summary || "",
      lessons: review.lessons || [],
      nextActions: review.nextActions || [],
    };

    // Append to long-term file
    fs.appendFileSync(this.longFile, JSON.stringify(longPayload) + "\n", "utf-8");

    // Update short-term memory
    task.promoted = true;
    task.review = review;
    task.updatedAt = utcNow();
    this.writeShort(taskId, task);

    return longPayload;
  }

  reviewTaskToLong(
    taskId: string,
    summary = "",
    lessons?: string[],
    nextActions?: string[],
  ): LongTermMemory {
    const task = this.readShort(taskId);
    // Refuse to promote a task that has not finished yet.
    if (task.status === "running" || !task.finishedAt) {
      throw new Error(
        `Cannot review task ${taskId}: task has not finished (status=${task.status}).`,
      );
    }
    // Guard against double-promotion producing duplicate long-term records.
    if (task.promoted) {
      throw new Error(`Task ${taskId} has already been promoted to long-term memory.`);
    }
    const auto = this.buildReview(task);

    // NOTE: Array.filter returns [] (truthy) when all items are blank, so we
    // must check .length explicitly instead of relying on `||` to fall back.
    const cleanLessons = lessons?.filter((x) => x.trim());
    const cleanNext = nextActions?.filter((x) => x.trim());
    const merged: ReviewData = {
      reviewedAt: utcNow(),
      summary: summary.trim() || auto.summary || "",
      lessons: cleanLessons && cleanLessons.length > 0 ? cleanLessons : auto.lessons || [],
      nextActions: cleanNext && cleanNext.length > 0 ? cleanNext : auto.nextActions || [],
    };

    const longPayload: LongTermMemory = {
      taskId: task.taskId,
      command: task.command,
      argv: task.argv,
      cwd: task.cwd,
      status: task.status,
      returnCode: task.returnCode,
      createdAt: task.createdAt,
      finishedAt: task.finishedAt,
      reviewedAt: merged.reviewedAt || utcNow(),
      summary: merged.summary || "",
      lessons: merged.lessons || [],
      nextActions: merged.nextActions || [],
    };

    fs.appendFileSync(this.longFile, JSON.stringify(longPayload) + "\n", "utf-8");

    task.promoted = true;
    task.review = merged;
    task.updatedAt = utcNow();
    this.writeShort(taskId, task);

    return longPayload;
  }

  getShort(taskId: string): TaskMemory {
    return this.readShort(taskId);
  }

  /**
   * Read every task-shaped record in the short-term dir. Both the listing and
   * the count go through here so they can never disagree about what counts as
   * a task memory (a valid-JSON-but-not-a-task file must not inflate the
   * count that `paleo-memory status` and the agent system prompt report).
   */
  private readAllShort(): TaskMemory[] {
    const rows: TaskMemory[] = [];

    let files: string[];
    try {
      files = fs.readdirSync(this.shortDir).filter(isTaskFile);
    } catch {
      return rows;
    }

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.shortDir, file), "utf-8");
        const payload: unknown = JSON.parse(content);
        if (!isTaskMemoryShape(payload)) {
          continue;
        }
        rows.push(payload);
      } catch {
        // Skip invalid files
      }
    }

    return rows;
  }

  listShort(options: { limit?: number; status?: string } = {}): TaskMemory[] {
    const limit = normalizeLimit(options.limit, 20);
    const status = options.status || "";
    const rows = this.readAllShort();

    // Sort by updatedAt descending — filename sort is unreliable across
    // process restarts because the per-process counter resets.
    rows.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

    if (status) {
      return rows.filter((r) => r.status === status).slice(0, limit);
    }
    return rows.slice(0, limit);
  }

  listLong(options: { limit?: number } = {}): LongTermMemory[] {
    const limit = normalizeLimit(options.limit, 20);
    const rows: LongTermMemory[] = [];

    if (!fs.existsSync(this.longFile)) {
      return rows;
    }

    const lines = fs.readFileSync(this.longFile, "utf-8").split("\n").toReversed();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const payload = JSON.parse(trimmed) as LongTermMemory;
        rows.push(payload);
        if (rows.length >= limit) {
          break;
        }
      } catch {
        // Skip invalid lines
      }
    }

    return rows;
  }

  listArchiveShort(options: { limit?: number; status?: string } = {}): TaskMemory[] {
    const limit = normalizeLimit(options.limit, 20);
    const status = options.status || "";
    const rows: TaskMemory[] = [];

    if (!fs.existsSync(this.archiveShortDir)) {
      return rows;
    }

    const files = fs.readdirSync(this.archiveShortDir).filter(isTaskFile).toSorted().toReversed();

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.archiveShortDir, file), "utf-8");
        const payload: unknown = JSON.parse(content);
        if (!isTaskMemoryShape(payload)) {
          continue;
        }

        if (status && payload.status !== status) {
          continue;
        }

        rows.push(payload);
        if (rows.length >= limit) {
          break;
        }
      } catch {
        // Skip invalid files
      }
    }

    return rows;
  }

  archiveShort(
    options: {
      beforeDays?: number;
      status?: string;
      includeRunning?: boolean;
    } = {},
  ): ArchiveResult {
    const { beforeDays = 7, status = "", includeRunning = false } = options;
    const cutoff = new Date(Date.now() - beforeDays * 24 * 60 * 60 * 1000);

    let moved = 0;
    let skipped = 0;
    const archivedIds: string[] = [];

    // chat-*.json files are conversational day digests, not task memories —
    // exclude them from archiving so chat history is never swept away.
    const files = fs.readdirSync(this.shortDir).filter(isTaskFile);

    for (const file of files) {
      const filePath = path.join(this.shortDir, file);

      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const payload: unknown = JSON.parse(content);
        if (!isTaskMemoryShape(payload)) {
          skipped++;
          continue;
        }

        if (status && payload.status !== status) {
          skipped++;
          continue;
        }

        if (!includeRunning && payload.status === "running") {
          skipped++;
          continue;
        }

        const ts = payload.finishedAt || payload.updatedAt || payload.createdAt;
        let itemTime: Date;
        try {
          itemTime = new Date(ts);
        } catch {
          skipped++;
          continue;
        }
        // Treat invalid dates (e.g. when ts is undefined or unparseable) as
        // "cannot determine age" — skip rather than accidentally archive.
        if (Number.isNaN(itemTime.getTime())) {
          skipped++;
          continue;
        }
        if (itemTime > cutoff) {
          skipped++;
          continue;
        }

        // Move to archive
        let dst = path.join(this.archiveShortDir, file);
        if (fs.existsSync(dst)) {
          const random = Math.random().toString(36).substring(2, 8);
          dst = path.join(this.archiveShortDir, `${path.parse(file).name}-${random}.json`);
        }

        fs.renameSync(filePath, dst);
        moved++;
        archivedIds.push(payload.taskId);
      } catch {
        skipped++;
      }
    }

    return {
      moved,
      skipped,
      beforeDays,
      statusFilter: status,
      archiveDir: this.archiveShortDir,
      archivedTaskIds: archivedIds,
    };
  }

  searchMemory(options: {
    query: string;
    scope?: string;
    topK?: number;
    minScore?: number;
    /**
     * Session whose chat digests may be recalled. Chat transcripts are
     * session-private: a caller that does not name a session gets no chat
     * corpus at all, so one user's conversation can never be injected into
     * another user's prompt by accident.
     */
    sessionId?: string;
    /**
     * Owner-side opt-in: recall chat digests from EVERY session instead of
     * one. This exists for the `paleo-memory` CLI, where the operator is
     * deliberately browsing their own store. The agent path must never set
     * it — it always names its own session.
     */
    includeAllSessions?: boolean;
  }): SearchItem[] {
    const { query, scope = "long", topK = 5, minScore = 0.15 } = options;
    const scopeText = scope.toLowerCase() || "long";

    if (!["short", "long", "archive", "all"].includes(scopeText)) {
      throw new Error("scope must be one of: short, long, archive, all");
    }

    const items: SearchItem[] = [];

    if (scopeText === "short" || scopeText === "all") {
      for (const row of this.listShort({ limit: 500 })) {
        items.push({
          source: "short",
          taskId: row.taskId,
          searchText: this.buildSearchText(row, "short"),
          payload: row as unknown as Record<string, unknown>,
        });
      }

      // Chat day digests share shortDir with task memories but are a distinct
      // record shape, so they are indexed separately (and with their own search
      // text) rather than being filtered out of the corpus entirely.
      //
      // Chat content is session-scoped: only the owning session's digests are
      // indexed. Task memories above stay global — they describe work, not
      // conversations, and carry no session identity.
      const rawSessionId = String(options.sessionId ?? "").trim();
      const sessionKey = rawSessionId ? safeSessionKey(rawSessionId) : "";
      // Owner-side tooling (the `paleo-memory` CLI) may explicitly opt into
      // every session's digests. The agent path never does — it always names
      // its own session — so one user's conversation can never leak into
      // another user's prompt.
      const includeAllSessions = options.includeAllSessions === true;
      if (sessionKey || includeAllSessions) {
        const chatRecords = this.listChatDaily(CHAT_RETRIEVAL_WINDOW_DAYS)
          .filter((chat) => includeAllSessions || chat.sessionId === sessionKey)
          .slice(0, CHAT_RETRIEVAL_MAX_ITEMS);

        for (const chat of chatRecords) {
          const searchText = this.buildChatSearchText(chat);
          if (!searchText) {
            continue;
          }
          const turns = chat.chat_digest?.recent_turns ?? [];
          const lastTurn = turns[turns.length - 1];
          items.push({
            source: "chat",
            taskId: `chat-${chat.day}-${chat.sessionId}`,
            searchText,
            payload: {
              day: chat.day,
              sessionId: chat.sessionId,
              turnCount: chat.chat_digest?.turn_count ?? 0,
              excerpt: lastTurn?.user || lastTurn?.assistant || "",
            },
          });
        }
      }
    }

    if (scopeText === "archive" || scopeText === "all") {
      for (const row of this.listArchiveShort({ limit: 1000 })) {
        items.push({
          source: "archive",
          taskId: row.taskId,
          searchText: this.buildSearchText(row, "archive"),
          payload: row as unknown as Record<string, unknown>,
        });
      }
    }

    if (scopeText === "long" || scopeText === "all") {
      for (const row of this.listLong({ limit: 1000 })) {
        items.push({
          source: "long",
          taskId: row.taskId,
          searchText: this.buildSearchText(row as unknown as TaskMemory, "long"),
          payload: row as unknown as Record<string, unknown>,
        });
      }
    }

    return bestMatches(query, items, topK, minScore);
  }

  countShort(): number {
    // Same filter as listShort(): a valid-JSON-but-not-a-task file must not
    // inflate the count reported by `paleo-memory status` and the agent
    // system prompt.
    return this.readAllShort().length;
  }

  countLong(): number {
    try {
      if (!fs.existsSync(this.longFile)) {
        return 0;
      }
      const content = fs.readFileSync(this.longFile, "utf-8");
      return content.split("\n").filter((line) => line.trim()).length;
    } catch {
      return 0;
    }
  }

  getStatus(): {
    shortCount: number;
    longCount: number;
    memoryRoot: string;
    shortDir: string;
    longFile: string;
  } {
    return {
      shortCount: this.countShort(),
      longCount: this.countLong(),
      memoryRoot: this.root,
      shortDir: this.shortDir,
      longFile: this.longFile,
    };
  }
}
