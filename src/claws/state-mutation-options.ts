import type { OpenClawStateDatabaseOptions } from "../state/paleoclaw-state-db-contract.js";

export type ClawMutationStateOptions = OpenClawStateDatabaseOptions & {
  stateMode?: "worker";
  assertCurrent?: () => void;
};
