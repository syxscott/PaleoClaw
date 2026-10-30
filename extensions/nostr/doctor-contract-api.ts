import fs from "node:fs/promises";
import path from "node:path";
import { extractErrorCode } from "paleoclaw/plugin-sdk/error-runtime";
import type { PluginDoctorStateMigration } from "paleoclaw/plugin-sdk/runtime-doctor-migrations";

function retiredNostrStateMigration(namespace: string, label: string): PluginDoctorStateMigration {
  const warning = `${label} JSON imports were retired. Upgrade to paleoclaw 2026.9.5 and run paleoclaw doctor --fix before upgrading to the latest version. Legacy files were left untouched.`;
  const hasLegacyState = async (stateDir: string) => {
    try {
      const names = await fs.readdir(path.join(stateDir, "nostr"));
      return names.some((name) => name.startsWith(`${namespace}-`) && name.endsWith(".json"));
    } catch (error) {
      if (extractErrorCode(error) === "ENOENT") {
        return false;
      }
      throw error;
    }
  };
  return {
    id: `nostr-${namespace}-json-to-plugin-state`,
    label,
    collectBackupResources: () => [],
    async detectLegacyState({ stateDir }) {
      return (await hasLegacyState(stateDir)) ? { preview: [warning] } : null;
    },
    async migrateLegacyState({ stateDir }) {
      return { changes: [], warnings: (await hasLegacyState(stateDir)) ? [warning] : [] };
    },
  };
}

export const stateMigrations: PluginDoctorStateMigration[] = [
  retiredNostrStateMigration("bus-state", "Nostr bus state"),
  retiredNostrStateMigration("profile-state", "Nostr profile state"),
];
