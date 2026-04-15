/**
 * Runtime switches for PaleoClaw integrations.
 * Controlled via environment variables to avoid config schema migrations.
 */

function readEnvFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) {
    return defaultValue;
  }

  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

export function isMemoryContextEnabled(): boolean {
  return readEnvFlag("PALEOCLAW_ENABLE_MEMORY_CONTEXT", true);
}

export function isSessionAutosaveEnabled(): boolean {
  return readEnvFlag("PALEOCLAW_ENABLE_SESSION_AUTOSAVE", true);
}

export function isAutoToolsEnabled(): boolean {
  return readEnvFlag("PALEOCLAW_ENABLE_AUTO_TOOLS", true);
}
