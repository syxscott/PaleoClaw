#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const paleoclaw = fileURLToPath(new URL("../../../paleoclaw.mjs", import.meta.url));
const result = spawnSync(process.execPath, [paleoclaw, ...process.argv.slice(2)], {
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  process.stderr.write(`Unable to run the bundled paleoclaw CLI: ${result.error.message}\n`);
}
process.exit(result.status ?? 1);
