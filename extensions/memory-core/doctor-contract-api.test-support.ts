import type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";
import {
  createPluginStateKeyedStoreForTests,
  getPluginStateCapacityForTests,
  importPluginStateEntriesForDoctorForTests,
  resetPluginStateStoreForTests,
} from "paleoclaw/plugin-sdk/plugin-state-test-runtime";
import type {
  OpenKeyedStoreOptions,
  PluginDoctorStateMigrationContext,
} from "paleoclaw/plugin-sdk/runtime-doctor-migrations";
import {
  closeOpenClawAgentDatabasesAsync,
  closeOpenClawAgentDatabasesForTest,
  closeOpenClawStateDatabaseAsync,
} from "paleoclaw/plugin-sdk/sqlite-runtime-testing";

type AuthoredAgents = NonNullable<OpenClawConfig["agents"]>;
type AuthoredEntry = NonNullable<AuthoredAgents["entries"]>[string];
type AuthoredMemory = NonNullable<OpenClawConfig["memory"]>;
type AuthoredMemorySearch = NonNullable<AuthoredMemory["search"]>;
type RawLegacyMemorySearch = Omit<AuthoredMemorySearch, "store"> & {
  store?: NonNullable<AuthoredMemorySearch["store"]> & { path?: string };
};
/** Pre-Doctor memory-core config: retired roster rows, default markers, and legacy memory-search keys. */
export type RawLegacyDoctorConfig = Omit<OpenClawConfig, "agents" | "memory"> & {
  agents?: Omit<AuthoredAgents, "entries"> & {
    entries?: Record<string, AuthoredEntry & { default?: boolean }>;
    list?: unknown[];
  };
  memory?: Omit<AuthoredMemory, "search"> & { search?: RawLegacyMemorySearch };
  memorySearch?: RawLegacyMemorySearch;
};

export function createDoctorContext(env: NodeJS.ProcessEnv): PluginDoctorStateMigrationContext {
  return {
    getPluginStateCapacity() {
      return getPluginStateCapacityForTests("memory-core", env);
    },
    importPluginStateEntries(options, entries) {
      importPluginStateEntriesForDoctorForTests(
        "memory-core",
        { ...options, env: options.env ?? env },
        entries,
      );
    },
    openPluginStateKeyedStore<T>(options: OpenKeyedStoreOptions) {
      return createPluginStateKeyedStoreForTests<T>("memory-core", {
        ...options,
        env: options.env ?? env,
      });
    },
  };
}

export async function resetDoctorPluginState() {
  await closeOpenClawAgentDatabasesAsync();
  closeOpenClawAgentDatabasesForTest();
  await closeOpenClawStateDatabaseAsync();
  resetPluginStateStoreForTests();
}
