/**
 * PaleoClaw Memory Store - Short-term and long-term memory management
 * Adapted from GeoClaw-OpenAI v2.4.0
 */

import * as fs from "fs";
import * as path from "path";
import { paleoclawHome, atomicWriteFile, ensurePrivateDir } from "../paths.js";
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
   * Fold one chat turn into the session's day file
   * (chat-YYYYMMDD-<safeSessionId>.json in the short-term dir). Only a
   * rolling digest is kept — recent_turns holds at most the last 8 turns
   * (user text clipped to 160 chars, assistant to 200, as in GeoClaw) and
   * intents/modes the last 10 distinct values — so full transcripts are
   * never persisted. Ported from GeoClaw's record_chat_turn.
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
  }

  /**
   * List chat day files, most recent first (by filename date descending).
   * Defaults to the last 7 days; corrupt files are skipped. Ported from
   * GeoClaw's list_chat_daily.
   */
  listChatDaily(days = 7): ChatDailyRecord[] {
    const rows: ChatDailyRecord[] = [];
    const requested = Math.floor(Number(days));
    const limit = Number.isFinite(requested) ? Math.max(1, requested) : 7;

    let files: string[] = [];
    try {
      files = fs
        .readdirSync(this.shortDir)
        .filter((f) => /^chat-\d{8}-.+\.json$/.test(f))
        .toSorted()
        .toReversed();
    } catch {
      return rows;
    }

    for (const file of files) {
      if (rows.length >= limit) {
        break;
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

  listShort(options: { limit?: number; status?: string } = {}): TaskMemory[] {
    const { limit = 20, status = "" } = options;
    const rows: TaskMemory[] = [];

    const files = fs.readdirSync(this.shortDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.shortDir, file), "utf-8");
        const payload = JSON.parse(content) as TaskMemory;
        rows.push(payload);
      } catch {
        // Skip invalid files
      }
    }

    // Sort by updatedAt descending — filename sort is unreliable across
    // process restarts because the per-process counter resets.
    rows.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

    if (status) {
      return rows.filter((r) => r.status === status).slice(0, limit);
    }
    return rows.slice(0, limit);
  }

  listLong(options: { limit?: number } = {}): LongTermMemory[] {
    const { limit = 20 } = options;
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
    const { limit = 20, status = "" } = options;
    const rows: TaskMemory[] = [];

    if (!fs.existsSync(this.archiveShortDir)) {
      return rows;
    }

    const files = fs
      .readdirSync(this.archiveShortDir)
      .filter((f) => f.endsWith(".json"))
      .toSorted()
      .toReversed();

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.archiveShortDir, file), "utf-8");
        const payload = JSON.parse(content) as TaskMemory;

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
    const files = fs
      .readdirSync(this.shortDir)
      .filter((f) => f.endsWith(".json") && !f.startsWith("chat-"));

    for (const file of files) {
      const filePath = path.join(this.shortDir, file);

      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const payload = JSON.parse(content) as TaskMemory;

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
    try {
      return fs.readdirSync(this.shortDir).filter((f) => f.endsWith(".json")).length;
    } catch {
      return 0;
    }
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
