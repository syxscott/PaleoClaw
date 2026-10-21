import type { CodeModeWorkerPayload } from "paleoclaw/plugin-sdk/code-mode-executor-runtime";
import type { Snapshot } from "quickjs-wasi";

export type QuickJsWorkerPayload = CodeModeWorkerPayload<Snapshot> & {
  wasmModule: WebAssembly.Module;
  wasmExtensions: Array<{ name: string; wasm: WebAssembly.Module }>;
};
