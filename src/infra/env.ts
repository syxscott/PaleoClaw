import { createSubsystemLogger } from "../logging/subsystem.js";
import { parseBooleanValue } from "../utils/boolean.js";

const log = createSubsystemLogger("env");
const loggedEnv = new Set<string>();

type AcceptedEnvOption = {
  key: string;
  description: string;
  value?: string;
  redact?: boolean;
};

function formatEnvValue(value: string, redact?: boolean): string {
  if (redact) {
    return "<redacted>";
  }
  const singleLine = value.replace(/\s+/g, " ").trim();
  if (singleLine.length <= 160) {
    return singleLine;
  }
  return `${singleLine.slice(0, 160)}…`;
}

export function logAcceptedEnvOption(option: AcceptedEnvOption): void {
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return;
  }
  if (loggedEnv.has(option.key)) {
    return;
  }
  const rawValue = option.value ?? process.env[option.key];
  if (!rawValue || !rawValue.trim()) {
    return;
  }
  loggedEnv.add(option.key);
  log.info(`env: ${option.key}=${formatEnvValue(rawValue, option.redact)} (${option.description})`);
}

export function normalizeZaiEnv(): void {
  if (!process.env.ZAI_API_KEY?.trim() && process.env.Z_AI_API_KEY?.trim()) {
    process.env.ZAI_API_KEY = process.env.Z_AI_API_KEY;
  }
}

export function isTruthyEnvValue(value?: string): boolean {
  return parseBooleanValue(value) === true;
}

// ===== 统一调试配置系统 =====

export interface DebugConfig {
  // Telegram 相关调试
  telegramAccounts: boolean;
  
  // 内存嵌入相关调试  
  memoryEmbeddings: boolean;
  
  // 健康检查相关调试
  health: boolean;
  
  // NextCloud Talk 相关调试
  nextcloudTalkAccounts: boolean;
  
  // 通用调试开关 - 如果设置了这个，则启用所有调试
  all: boolean;
}

// 默认调试配置
const DEFAULT_DEBUG_CONFIG: DebugConfig = {
  telegramAccounts: false,
  memoryEmbeddings: false,
  health: false,
  nextcloudTalkAccounts: false,
  all: false
};

/**
 * 从环境变量中加载调试配置
 */
export function loadDebugConfig(): DebugConfig {
  // 检查是否有通用调试开关
  const allDebug = isTruthyEnvValue(process.env.PALEOCLAW_DEBUG_ALL) || 
                   isTruthyEnvValue(process.env.OPENCLAW_DEBUG_ALL);
  
  return {
    telegramAccounts: allDebug || isTruthyEnvValue(process.env.PALEOCLAW_DEBUG_TELEGRAM_ACCOUNTS) || 
                      isTruthyEnvValue(process.env.OPENCLAW_DEBUG_TELEGRAM_ACCOUNTS),
    memoryEmbeddings: allDebug || isTruthyEnvValue(process.env.PALEOCLAW_DEBUG_MEMORY_EMBEDDINGS) || 
                      isTruthyEnvValue(process.env.OPENCLAW_DEBUG_MEMORY_EMBEDDINGS),
    health: allDebug || isTruthyEnvValue(process.env.PALEOCLAW_DEBUG_HEALTH) || 
            isTruthyEnvValue(process.env.OPENCLAW_DEBUG_HEALTH),
    nextcloudTalkAccounts: allDebug || isTruthyEnvValue(process.env.PALEOCLAW_DEBUG_NEXTCLOUD_TALK_ACCOUNTS) || 
                           isTruthyEnvValue(process.env.OPENCLAW_DEBUG_NEXTCLOUD_TALK_ACCOUNTS),
    all: allDebug
  };
}

/**
 * 获取当前调试配置的单例实例
 */
let debugConfigInstance: DebugConfig | null = null;

export function getDebugConfig(): DebugConfig {
  if (!debugConfigInstance) {
    debugConfigInstance = loadDebugConfig();
  }
  return debugConfigInstance;
}

/**
 * 检查特定调试选项是否启用
 */
export function isDebugEnabled(category: keyof DebugConfig): boolean {
  const config = getDebugConfig();
  return config[category] || config.all;
}

/**
 * 重置调试配置（主要用于测试）
 */
export function resetDebugConfig(): void {
  debugConfigInstance = null;
}

export function normalizeEnv(): void {
  normalizeZaiEnv();
}
