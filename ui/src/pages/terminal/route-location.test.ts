// @vitest-environment node
import { describe, expect, it } from "vitest";
import { INTERNAL_TERMINAL_PATH_PARAM } from "../../app-route-paths.ts";
import { catalogSessionSearch } from "../../lib/sessions/catalog-key.ts";
import { resolveTerminalRouteLocation } from "./route-location.ts";

const catalog = {
  catalogId: "codex",
  hostId: "node:local",
  threadId: "thread ?&/1",
  sourceHomeId: "selected-home",
};

describe("terminal route location", () => {
  it("opens the default terminal surface without a target", () => {
    expect(
      resolveTerminalRouteLocation({ pathname: "/terminal", search: "", hash: "" }),
    ).toBeNull();
  });

  it("reads the shared catalog query grammar", () => {
    expect(
      resolveTerminalRouteLocation(
        { pathname: "/paleoclaw/terminal", search: catalogSessionSearch(catalog), hash: "" },
        "/paleoclaw",
      ),
    ).toEqual({ catalog });
  });

  it("gives an explicit terminal session precedence over catalog query", () => {
    expect(
      resolveTerminalRouteLocation({
        pathname: "/terminal/pty-1",
        search: catalogSessionSearch(catalog),
        hash: "",
      }),
    ).toEqual({ sessionId: "pty-1" });
  });

  it("restores an initial dynamic path from the router bridge", () => {
    expect(
      resolveTerminalRouteLocation(
        {
          pathname: "/paleoclaw/terminal",
          search: `?${new URLSearchParams({ [INTERNAL_TERMINAL_PATH_PARAM]: "/paleoclaw/terminal/pty-1" })}`,
          hash: "",
        },
        "/paleoclaw",
      ),
    ).toEqual({ sessionId: "pty-1" });
  });

  it("ignores an incomplete catalog reference", () => {
    expect(
      resolveTerminalRouteLocation({
        pathname: "/terminal",
        search: "?catalog=codex&thread=a",
        hash: "",
      }),
    ).toBeNull();
  });
});
