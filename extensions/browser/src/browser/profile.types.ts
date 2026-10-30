import type { BrowserProfileConfig } from "paleoclaw/plugin-sdk/config-contracts";

export type ManagedBrowserHeadlessSource = "request" | "env" | "profile" | "config" | "default";

export type ResolvedBrowserProfile = {
  name: string;
  /** Omitted only by legacy callers; defaults to Chromium. */
  engine?: NonNullable<BrowserProfileConfig["engine"]>;
  cdpPort: number;
  cdpUrl: string;
  cdpHost: string;
  cdpIsLoopback: boolean;
  userDataDir?: string;
  mcpCommand?: string;
  mcpArgs?: string[];
  color: string;
  driver: "paleoclaw" | "existing-session" | "extension";
  executablePath?: string;
  headless: boolean;
  headlessSource?: "profile" | "config" | "default";
  attachOnly: boolean;
};
