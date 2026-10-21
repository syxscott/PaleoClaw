import { runTsxCliShim } from "./tsx-cli-shim.mjs";

await runTsxCliShim(import.meta.url, {
  implementation: "./paleoclaw-test-state.mts",
});
