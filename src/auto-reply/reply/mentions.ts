import { resolveAgentConfig } from "../../agents/agent-scope.js";
import { getChannelDock } from "../../channels/dock.js";
import { normalizeChannelId } from "../../channels/plugins/index.js";
import type { OpenClawConfig } from "../../config/config.js";
import { escapeRegExp } from "../../utils.js";
import type { MsgContext } from "../templating.js";

function deriveMentionPatterns(identity?: { name?: string; emoji?: string }) {
  const patterns: string[] = [];
  const name = identity?.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean).map(escapeRegExp);
    const re = parts.length ? parts.join(String.raw`\s+`) : escapeRegExp(name);
    patterns.push(String.raw`\b@?${re}\b`);
  }
  const emoji = identity?.emoji?.trim();
  if (emoji) {
    patterns.push(escapeRegExp(emoji));
  }
  return patterns;
}

const BACKSPACE_CHAR = "\u0008";
const CANONICAL_BRAND = "paleoclaw";
// PaleoClaw was renamed from "openclaw"; configured mention patterns and inbound
// text may still use the legacy brand. Normalize both sides to the canonical
// name so existing patterns keep matching after the rename.
const LEGACY_BRAND_REGEX = /openclaw/gi;
const LEGACY_BRAND_TEST_REGEX = /openclaw/i;
const mentionRegexCompileCache = new Map<string, RegExp[]>();
const brandRewrittenRegexCache = new WeakMap<RegExp, RegExp>();
const MAX_MENTION_REGEX_COMPILE_CACHE_KEYS = 512;

function normalizeBrandAlias(value: string): string {
  return value.replace(LEGACY_BRAND_REGEX, CANONICAL_BRAND);
}

export const CURRENT_MESSAGE_MARKER = "[Current message - respond to this]";

function normalizeMentionPattern(pattern: string): string {
  const expanded = pattern.includes(BACKSPACE_CHAR)
    ? pattern.split(BACKSPACE_CHAR).join("\\b")
    : pattern;
  return normalizeBrandAlias(expanded);
}

function normalizeMentionPatterns(patterns: string[]): string[] {
  return patterns.map(normalizeMentionPattern);
}

function resolveMentionPatterns(cfg: OpenClawConfig | undefined, agentId?: string): string[] {
  if (!cfg) {
    return [];
  }
  const agentConfig = agentId ? resolveAgentConfig(cfg, agentId) : undefined;
  const agentGroupChat = agentConfig?.groupChat;
  if (agentGroupChat && Object.hasOwn(agentGroupChat, "mentionPatterns")) {
    return agentGroupChat.mentionPatterns ?? [];
  }
  const globalGroupChat = cfg.messages?.groupChat;
  if (globalGroupChat && Object.hasOwn(globalGroupChat, "mentionPatterns")) {
    return globalGroupChat.mentionPatterns ?? [];
  }
  const derived = deriveMentionPatterns(agentConfig?.identity);
  return derived.length > 0 ? derived : [];
}

export function buildMentionRegexes(cfg: OpenClawConfig | undefined, agentId?: string): RegExp[] {
  const patterns = normalizeMentionPatterns(resolveMentionPatterns(cfg, agentId));
  if (patterns.length === 0) {
    return [];
  }
  const cacheKey = patterns.join("\u001f");
  const cached = mentionRegexCompileCache.get(cacheKey);
  if (cached) {
    return [...cached];
  }
  const compiled = patterns
    .map((pattern) => {
      try {
        return new RegExp(pattern, "i");
      } catch {
        return null;
      }
    })
    .filter((value): value is RegExp => Boolean(value));
  mentionRegexCompileCache.set(cacheKey, compiled);
  if (mentionRegexCompileCache.size > MAX_MENTION_REGEX_COMPILE_CACHE_KEYS) {
    mentionRegexCompileCache.clear();
    mentionRegexCompileCache.set(cacheKey, compiled);
  }
  return [...compiled];
}

export function normalizeMentionText(text: string): string {
  return normalizeBrandAlias(
    (text ?? "").replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, "").toLowerCase(),
  );
}

/**
 * Rewrites legacy-brand regexes so hand-compiled mention regexes (e.g. built
 * directly from configured patterns) match the canonical brand in inbound text.
 */
function rewriteRegexBrandAlias(re: RegExp): RegExp {
  const cached = brandRewrittenRegexCache.get(re);
  if (cached) {
    return cached;
  }
  let rewritten = re;
  if (LEGACY_BRAND_TEST_REGEX.test(re.source)) {
    rewritten = new RegExp(re.source.replace(LEGACY_BRAND_REGEX, CANONICAL_BRAND), re.flags);
  }
  brandRewrittenRegexCache.set(re, rewritten);
  return rewritten;
}

export function matchesMentionPatterns(text: string, mentionRegexes: RegExp[]): boolean {
  if (mentionRegexes.length === 0) {
    return false;
  }
  const cleaned = normalizeMentionText(text ?? "");
  if (!cleaned) {
    return false;
  }
  return mentionRegexes.some((re) => rewriteRegexBrandAlias(re).test(cleaned));
}

export type ExplicitMentionSignal = {
  hasAnyMention: boolean;
  isExplicitlyMentioned: boolean;
  canResolveExplicit: boolean;
};

export function matchesMentionWithExplicit(params: {
  text: string;
  mentionRegexes: RegExp[];
  explicit?: ExplicitMentionSignal;
  transcript?: string;
}): boolean {
  const cleaned = normalizeMentionText(params.text ?? "");
  const explicit = params.explicit?.isExplicitlyMentioned === true;
  const explicitAvailable = params.explicit?.canResolveExplicit === true;
  const hasAnyMention = params.explicit?.hasAnyMention === true;

  // Check transcript if text is empty and transcript is provided
  const transcriptCleaned = params.transcript ? normalizeMentionText(params.transcript) : "";
  const textToCheck = cleaned || transcriptCleaned;

  if (hasAnyMention && explicitAvailable) {
    return (
      explicit || params.mentionRegexes.some((re) => rewriteRegexBrandAlias(re).test(textToCheck))
    );
  }
  if (!textToCheck) {
    return explicit;
  }
  return (
    explicit || params.mentionRegexes.some((re) => rewriteRegexBrandAlias(re).test(textToCheck))
  );
}

export function stripStructuralPrefixes(text: string): string {
  if (!text) {
    return "";
  }
  // Ignore wrapper labels, timestamps, and sender prefixes so directive-only
  // detection still works in group batches that include history/context.
  const afterMarker = text.includes(CURRENT_MESSAGE_MARKER)
    ? text.slice(text.indexOf(CURRENT_MESSAGE_MARKER) + CURRENT_MESSAGE_MARKER.length).trimStart()
    : text;

  return afterMarker
    .replace(/\[[^\]]+\]\s*/g, "")
    .replace(/^[ \t]*[A-Za-z0-9+()\-_. ]+:\s*/gm, "")
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripMentions(
  text: string,
  ctx: MsgContext,
  cfg: OpenClawConfig | undefined,
  agentId?: string,
): string {
  let result = text;
  const providerId = ctx.Provider ? normalizeChannelId(ctx.Provider) : null;
  const providerMentions = providerId ? getChannelDock(providerId)?.mentions : undefined;
  const patterns = normalizeMentionPatterns([
    ...resolveMentionPatterns(cfg, agentId),
    ...(providerMentions?.stripPatterns?.({ ctx, cfg, agentId }) ?? []),
  ]);
  for (const p of patterns) {
    try {
      const re = new RegExp(p, "gi");
      result = result.replace(re, " ");
    } catch {
      // ignore invalid regex
    }
  }
  if (providerMentions?.stripMentions) {
    result = providerMentions.stripMentions({
      text: result,
      ctx,
      cfg,
      agentId,
    });
  }
  // Generic mention patterns like @123456789 or plain digits
  result = result.replace(/@[0-9+]{5,}/g, " ");
  return result.replace(/\s+/g, " ").trim();
}
