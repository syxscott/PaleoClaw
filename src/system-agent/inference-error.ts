import { truncateUtf16Safe } from "@paleoclaw/normalization-core/utf16-slice";
import { formatErrorMessage } from "../infra/errors.js";

type SystemAgentInferenceStage = "agent-turn" | "planner" | "conversation";
type SystemAgentInferenceGuidance =
  | "setup"
  | "retry"
  | "timeout"
  | "superseded"
  | "runtime-unavailable"
  | "route-changed"
  | "compatible-route";

const INFERENCE_GUIDANCE: Record<SystemAgentInferenceGuidance, string> = {
  setup:
    "paleoclaw could not reach working inference. Run `paleoclaw onboard` on the machine running paleoclaw to reconnect — it live-tests the route before saving it. Then try again.",
  retry:
    "The inference request failed or returned no usable reply. Try again; if it persists, check the model runtime logs.",
  timeout:
    "The inference request timed out. Try again; if it persists, check the model runtime and its timeout settings.",
  superseded:
    "The inference runtime was superseded during this turn. Try again after the current runtime settles.",
  "runtime-unavailable":
    "The prepared inference runtime became unavailable or was superseded during this turn. Try again; if it persists, check the model runtime logs.",
  "route-changed":
    "The verified inference route changed or could not be reverified during this turn. Start a new paleoclaw conversation to verify the current route.",
  "compatible-route":
    "The configured CLI runtime cannot enforce paleoclaw's tool restrictions. Select a compatible model/runtime route and try again.",
};
const INFERENCE_FAILURE_SUMMARY_MAX_CHARS = 300;

function inferenceUnavailableMessage(
  failures: readonly unknown[],
  guidance: SystemAgentInferenceGuidance,
): string {
  const detail = failures.length > 0 ? formatErrorMessage(failures[0]).trim() : "";
  if (!detail) {
    return INFERENCE_GUIDANCE[guidance];
  }
  const summary =
    detail.length > INFERENCE_FAILURE_SUMMARY_MAX_CHARS
      ? `${truncateUtf16Safe(detail, INFERENCE_FAILURE_SUMMARY_MAX_CHARS - 1)}…`
      : detail;
  return `${INFERENCE_GUIDANCE[guidance]} Cause: ${summary}`;
}

/** Safe public error for an paleoclaw turn that could not complete with intelligence. */
export class SystemAgentInferenceUnavailableError extends Error {
  readonly code = "SYSTEM_AGENT_INFERENCE_UNAVAILABLE";

  constructor(
    readonly stage: SystemAgentInferenceStage,
    readonly failures: readonly unknown[] = [],
    guidance: SystemAgentInferenceGuidance = stage === "conversation" ? "setup" : "retry",
  ) {
    super(inferenceUnavailableMessage(failures, guidance));
    this.name = "SystemAgentInferenceUnavailableError";
  }
}

export function isSystemAgentInferenceUnavailableError(
  error: unknown,
): error is SystemAgentInferenceUnavailableError {
  return (
    error instanceof SystemAgentInferenceUnavailableError ||
    (error instanceof Error &&
      "code" in error &&
      error.code === "SYSTEM_AGENT_INFERENCE_UNAVAILABLE")
  );
}
