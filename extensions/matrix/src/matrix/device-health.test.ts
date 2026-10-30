// Matrix tests cover device health plugin behavior.
import { describe, expect, it } from "vitest";
import { listStaleOpenClawMatrixDevices } from "./device-health.js";

describe("matrix device health", () => {
  it("summarizes stale paleoclaw-managed devices separately from the current device", () => {
    const devices = [
      {
        deviceId: "du314Zpw3A",
        displayName: "paleoclaw Gateway",
        current: true,
      },
      {
        deviceId: "BritdXC6iL",
        displayName: "paleoclaw Gateway",
        current: false,
      },
      {
        deviceId: "G6NJU9cTgs",
        displayName: "paleoclaw Debug",
        current: false,
      },
      {
        deviceId: "phone123",
        displayName: "Element iPhone",
        current: false,
      },
      { deviceId: "unnamed", displayName: null, current: false },
    ];

    expect(listStaleOpenClawMatrixDevices(devices)).toEqual([devices[1], devices[2]]);
  });
});
