import { describe, expect, it } from "vitest";
import { resolveSessionStorePathCore } from "../config/sessions/paths.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { createActivitySummaryStorePaths } from "./session-activity-summary-state.js";

describe("activity summary store paths", () => {
  it("follows a store relocated by in-place config mutation", () => {
    const cfg: OpenClawConfig = { session: { store: "/tmp/first/paleoclaw-agent.sqlite" } };
    const storePathFor = createActivitySummaryStorePaths(() => cfg);
    expect(storePathFor("main")).toBe(
      resolveSessionStorePathCore(cfg.session?.store, { agentId: "main" }),
    );

    cfg.session = { store: "/tmp/second/paleoclaw-agent.sqlite" };
    expect(storePathFor("main")).toBe(
      resolveSessionStorePathCore(cfg.session.store, { agentId: "main" }),
    );
  });
});
