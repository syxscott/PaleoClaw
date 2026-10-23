import * as network from "paleoclaw/plugin-sdk/ssrf-runtime";
import { vi } from "vitest";

export function mockMatrixQaHttp(fetchImpl: typeof fetch) {
  const release = vi.fn(async () => {});
  const request = vi
    .spyOn(network, "fetchWithSsrFGuard")
    .mockImplementation(async ({ url, init }) => ({
      response: await fetchImpl(url, init),
      finalUrl: url,
      release,
    }));
  return { request, release };
}
