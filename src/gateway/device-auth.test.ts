/**
 * Gateway device-auth regression tests.
 */
import { describe, expect, it } from "vitest";
import {
  buildDeviceAuthPayload,
  buildDeviceAuthPayloadV3,
  normalizeDeviceMetadataForAuth,
} from "../../packages/gateway-client/src/device-auth.js";

const device = {
  deviceId: "dev-1",
  clientId: "paleoclaw-macos",
  clientMode: "ui",
  role: "operator",
  scopes: ["operator.admin", "operator.read"],
  signedAtMs: 1_700_000_000_000,
  nonce: "nonce-abc",
};

describe("device-auth payload vectors", () => {
  it.each([
    {
      name: "builds canonical v2 payloads",
      build: () =>
        buildDeviceAuthPayload({
          ...device,
          token: null,
        }),
      expected:
        "v2|dev-1|paleoclaw-macos|ui|operator|operator.admin,operator.read|1700000000000||nonce-abc",
    },
    {
      name: "builds canonical v3 payloads",
      build: () =>
        buildDeviceAuthPayloadV3({
          ...device,
          token: "tok-123",
          platform: "  IOS  ",
          deviceFamily: "  iPhone  ",
        }),
      expected:
        "v3|dev-1|paleoclaw-macos|ui|operator|operator.admin,operator.read|1700000000000|tok-123|nonce-abc|ios|iphone",
    },
    {
      name: "keeps empty metadata slots in v3 payloads",
      build: () =>
        buildDeviceAuthPayloadV3({
          deviceId: "dev-2",
          clientId: "paleoclaw-ios",
          clientMode: "ui",
          role: "operator",
          scopes: ["operator.read"],
          signedAtMs: 1_700_000_000_001,
          nonce: "nonce-def",
        }),
      expected: "v3|dev-2|paleoclaw-ios|ui|operator|operator.read|1700000000001||nonce-def||",
    },
  ])("$name", ({ build, expected }) => {
    expect(build()).toBe(expected);
  });

  it("preserves non-ASCII metadata while normalizing ASCII case", () => {
    expect(normalizeDeviceMetadataForAuth("  İOS  ")).toBe("İos");
  });
});
