import type { SessionManager } from "paleoclaw/plugin-sdk/agent-sessions";
import { expectTypeOf } from "vitest";

// agent sessions SDK
// keeps SessionManager.persist public
expectTypeOf<SessionManager["persist"]>().toBeFunction();

// keeps tool-result preparation internal
expectTypeOf<typeof import("paleoclaw/plugin-sdk/agent-sessions")>().not.toHaveProperty(
  "prepareSessionToolResult",
);
expectTypeOf<typeof import("paleoclaw/plugin-sdk/agent-sessions")>().not.toHaveProperty(
  "setSessionToolResultPreparer",
);
