import { createQaDockerRuntime } from "paleoclaw/plugin-sdk/qa-runtime";

const dockerRuntime = createQaDockerRuntime({
  auditContext: "qa-lab-docker-health-check",
  commandTimeoutMs: null,
});

export const {
  execCommand,
  fetchHealthUrl,
  resolveComposeServiceUrl,
  resolveHostPort,
  waitForDockerServiceHealth,
  waitForHealth,
} = dockerRuntime;
