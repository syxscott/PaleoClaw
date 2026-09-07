// Public barrel for shared coercion and normalization helpers.
//
// Vendored from OpenClaw 2026.9.2 `@openclaw/normalization-core` (dependency-free
// modules only, intra-package imports kept as relative .js specifiers). Not
// vendored here because they require external packages PaleoClaw does not ship:
// `json-schema` (typebox) and `phone-presentation` (libphonenumber-js).

export * from './balanced-json.js';
export * from './boolean-coercion.js';
export * from './cjk-chars.js';
export * from './code-points.js';
export * from './error-coercion.js';
export * from './expect.js';
export * from './format.js';
export * from './json-coercion.js';
export * from './number-coercion.js';
export * from './record-coerce.js';
export * from './stable-stringify.js';
export * from './string-coerce.js';
export * from './string-normalization.js';
export * from './text-decoding.js';
export * from './utf16-slice.js';

// Modules outside the upstream barrel that remain importable by path:
// agent-id.js, agent-run-terminal-outcome.js, browser-error-runtime.js,
// mountinfo-path.js, promise-like.js, result.js, stable-node-path.js.
