import type { AgentRunTerminalFacts } from "@paleoclaw/normalization-core/agent-run-terminal-outcome";

export type AgentRunTerminalOutcome = AgentRunTerminalFacts & {
  error?: string;
  startedAt?: number;
  endedAt?: number;
};
