import { VERSION } from "../version.js";
export { normalizeAcpProvenanceMode } from "@paleoclaw/acp-core/types";

/** ACP agent identity advertised during protocol initialization. */
export const ACP_AGENT_INFO = {
  name: "paleoclaw-acp",
  title: "paleoclaw ACP Gateway",
  version: VERSION,
};
