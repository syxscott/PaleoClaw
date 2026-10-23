import { callGatewayTool } from "paleoclaw/plugin-sdk/agent-harness-runtime";
import { readStringParam } from "paleoclaw/plugin-sdk/param-readers";
import type { AnyAgentTool } from "paleoclaw/plugin-sdk/plugin-entry";
import { asOptionalRecord } from "paleoclaw/plugin-sdk/string-coerce-runtime";
import { jsonResult } from "paleoclaw/plugin-sdk/tool-results";

export async function executeTalkVoiceTool(
  sessionKey: string | undefined,
  ...toolArgs: Parameters<AnyAgentTool["execute"]>
) {
  const [, args, signal] = toolArgs;
  const params = asOptionalRecord(args) ?? {};
  const action = readStringParam(params, "action", { required: true });
  let method: string;
  let request: Record<string, string>;
  switch (action) {
    case "list":
      method = "talk.voice.get";
      request = {};
      break;
    case "set":
      method = "talk.voice.set";
      request = { voice: readStringParam(params, "voice", { required: true }) };
      break;
    default:
      throw new Error(`Unknown Talk voice action: ${action}`);
  }
  if (sessionKey) {
    request.sessionKey = sessionKey;
  }
  return jsonResult(
    await callGatewayTool(method, { timeoutMs: 65_000 }, request, {
      requireAgentRuntimeIdentity: true,
      signal,
    }),
  );
}
