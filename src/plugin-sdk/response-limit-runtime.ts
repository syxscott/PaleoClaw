// Narrow response-size reader for plugins that download bounded HTTP bodies.

export { readByteStreamWithLimit } from "@paleoclaw/media-core/read-byte-stream-with-limit";
export { readResponseTextPrefix, readResponseWithLimit } from "../infra/http-response-body.js";
