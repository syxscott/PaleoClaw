import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { runExec } from "paleoclaw/plugin-sdk/process-runtime";
import { toRepoRelativePath } from "./cli-paths.js";
import { seedQaAgentWorkspace } from "./qa-agent-workspace.js";
import {
  createQaChannelGatewayConfig,
  QA_CHANNEL_REQUIRED_PLUGIN_IDS,
} from "./qa-channel-transport.js";
import { buildQaGatewayConfig } from "./qa-gateway-config.js";

const QA_LAB_INTERNAL_PORT = 43123;
const QA_LAB_UI_OVERLAY_DIR = "/opt/paleoclaw-qa-lab-ui";
// The QA config enables ACPX. Bake the external plugin so ephemeral Gateways do
// not block startup on a network install before their health deadline.
const QA_DOCKER_PLUGIN_SELECTION = "acpx qa-channel qa-lab";

function renderHealthcheck(port: number, retries: number, startPeriod: number) {
  return `    healthcheck:
      test:
        - CMD
        - node
        - -e
        - fetch("http://127.0.0.1:${port}/healthz").then(async(r)=>{await r.body?.cancel();process.exitCode=r.ok?0:1}).catch(()=>{process.exitCode=1})
      interval: 10s
      timeout: 5s
      retries: ${retries}
      start_period: ${startPeriod}s
`;
}

function renderCompose(params: {
  outputDir: string;
  repoRoot: string;
  imageName: string;
  usePrebuiltImage: boolean;
  bindUiDist: boolean;
  gatewayPort: number;
  qaLabPort: number;
}) {
  const repoMount = toRepoRelativePath(params.outputDir, params.repoRoot) || ".";
  const imageBlock = params.usePrebuiltImage
    ? `    image: ${params.imageName}\n`
    : `    build:\n      context: ${JSON.stringify(repoMount)}\n      dockerfile: Dockerfile\n      args:\n        OPENCLAW_EXTENSIONS: "${QA_DOCKER_PLUGIN_SELECTION}"\n`;
  const taxonomyMount = toRepoRelativePath(
    params.outputDir,
    path.join(params.repoRoot, "taxonomy.yaml"),
  );
  const qaLabUiMount = toRepoRelativePath(
    params.outputDir,
    path.join(params.repoRoot, "extensions", "qa-lab", "web", "dist"),
  );

  return `services:
  qa-mock-openai:
${imageBlock}    pull_policy: never
${renderHealthcheck(44080, 6, 3)}    environment:
      OPENCLAW_ENABLE_PRIVATE_QA_CLI: "1"
      OPENCLAW_PROFILE: ""
    command:
      - node
      - dist/index.js
      - qa
      - mock-openai
      - --host
      - "0.0.0.0"
      - --port
      - "44080"
  qa-lab:
${imageBlock}    pull_policy: never
    ports:
      - "127.0.0.1:${params.qaLabPort}:${QA_LAB_INTERNAL_PORT}"
    volumes:
      - ./state:/opt/paleoclaw-scaffold:ro
      - ${JSON.stringify(`${taxonomyMount}:/app/taxonomy.yaml:ro`)}
${params.bindUiDist ? `      - ${JSON.stringify(`${qaLabUiMount}:${QA_LAB_UI_OVERLAY_DIR}:ro`)}\n` : ""}${renderHealthcheck(QA_LAB_INTERNAL_PORT, 6, 5)}    environment:
      OPENCLAW_ENABLE_PRIVATE_QA_CLI: "1"
      OPENCLAW_CONFIG_PATH: /opt/paleoclaw-scaffold/openclaw.json
      OPENCLAW_STATE_DIR: /tmp/paleoclaw/state
      OPENCLAW_SKIP_GMAIL_WATCHER: "1"
      OPENCLAW_SKIP_BROWSER_CONTROL_SERVER: "1"
      OPENCLAW_SKIP_CANVAS_HOST: "1"
      OPENCLAW_PROFILE: ""
    command:
      - sh
      - -lc
      - OPENCLAW_QA_CONTROL_UI_PROXY_TOKEN="$(node -e 'const fs=require("node:fs");const cfg=JSON.parse(fs.readFileSync("/opt/paleoclaw-scaffold/openclaw.json","utf8"));process.stdout.write(cfg.gateway?.auth?.token ?? "")')" exec node dist/index.js qa ui --host 0.0.0.0 --port ${QA_LAB_INTERNAL_PORT} --advertise-host 127.0.0.1 --advertise-port ${params.qaLabPort} --control-ui-url http://127.0.0.1:${params.gatewayPort}/ --control-ui-proxy-target http://paleoclaw-qa-gateway:18789/${params.bindUiDist ? ` --ui-dist-dir ${QA_LAB_UI_OVERLAY_DIR}` : ""} --auto-kickoff-target direct --send-kickoff-on-start --embedded-gateway disabled
    depends_on:
      qa-mock-openai:
        condition: service_healthy
  paleoclaw-qa-gateway:
${imageBlock}    pull_policy: never
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ports:
      - "127.0.0.1:${params.gatewayPort}:18789"
    environment:
      OPENCLAW_CONFIG_PATH: /tmp/paleoclaw/openclaw.json
      OPENCLAW_STATE_DIR: /tmp/paleoclaw/state
      OPENCLAW_NO_RESPAWN: "1"
      OPENCLAW_SKIP_GMAIL_WATCHER: "1"
      OPENCLAW_SKIP_BROWSER_CONTROL_SERVER: "1"
      OPENCLAW_SKIP_CANVAS_HOST: "1"
      OPENCLAW_PROFILE: ""
    volumes:
      - ./state:/opt/paleoclaw-scaffold:ro
      - ${JSON.stringify(`${repoMount}:/opt/paleoclaw-repo:ro`)}
${renderHealthcheck(18789, 12, 15)}    depends_on:
      qa-lab:
        condition: service_healthy
      qa-mock-openai:
        condition: service_healthy
    command:
      - sh
      - -lc
      - mkdir -p /tmp/paleoclaw/workspace /tmp/paleoclaw/state && cp /opt/paleoclaw-scaffold/openclaw.json /tmp/paleoclaw/openclaw.json && cp -R /opt/paleoclaw-scaffold/seed-workspace/. /tmp/paleoclaw/workspace/ && rm -rf /tmp/paleoclaw/workspace/repo && ln -s /opt/paleoclaw-repo /tmp/paleoclaw/workspace/repo && exec node dist/index.js gateway run --port 18789 --bind lan --allow-unconfigured
`;
}

export async function writeQaDockerHarnessFiles(params: {
  outputDir: string;
  repoRoot: string;
  gatewayPort?: number;
  qaLabPort?: number;
  gatewayToken?: string;
  providerBaseUrl?: string;
  qaBusBaseUrl?: string;
  imageName?: string;
  usePrebuiltImage?: boolean;
  bindUiDist?: boolean;
}) {
  const gatewayPort = params.gatewayPort ?? 18789;
  const qaLabPort = params.qaLabPort ?? 43124;
  const gatewayToken = params.gatewayToken ?? `qa-token-${randomUUID()}`;
  const providerBaseUrl = params.providerBaseUrl ?? "http://qa-mock-openai:44080/v1";
  const qaBusBaseUrl = params.qaBusBaseUrl ?? "http://qa-lab:43123";
  const imageName = params.imageName ?? "paleoclaw:qa-local-prebaked";
  const usePrebuiltImage = params.usePrebuiltImage ?? false;
  const bindUiDist = params.bindUiDist ?? false;

  await fs.mkdir(path.join(params.outputDir, "state", "seed-workspace"), { recursive: true });
  await seedQaAgentWorkspace({
    workspaceDir: path.join(params.outputDir, "state", "seed-workspace"),
    repoRoot: params.repoRoot,
  });

  const config = buildQaGatewayConfig({
    bind: "lan",
    gatewayPort: 18789,
    gatewayToken,
    providerBaseUrl,
    workspaceDir: "/tmp/paleoclaw/workspace",
    controlUiRoot: "/app/dist/control-ui",
    enabledPluginIds: ["acpx"],
    transportPluginIds: QA_CHANNEL_REQUIRED_PLUGIN_IDS,
    transportConfig: createQaChannelGatewayConfig({
      baseUrl: qaBusBaseUrl,
    }),
  });

  const files = [
    [
      "docker-compose.qa.yml",
      renderCompose({
        outputDir: params.outputDir,
        repoRoot: params.repoRoot,
        imageName,
        usePrebuiltImage,
        bindUiDist,
        gatewayPort,
        qaLabPort,
      }),
    ],
    [
      ".env.example",
      `# QA Docker harness example env
OPENCLAW_GATEWAY_TOKEN=${gatewayToken}
QA_GATEWAY_PORT=${gatewayPort}
QA_BUS_BASE_URL=${qaBusBaseUrl}
QA_PROVIDER_BASE_URL=${providerBaseUrl}
QA_LAB_URL=http://127.0.0.1:${qaLabPort}
`,
    ],
    [
      "README.md",
      `# QA Docker Harness

Generated scaffold for the Docker-backed QA lane.

Files:

- \`docker-compose.qa.yml\`
- \`.env.example\`
- \`state/openclaw.json\`

Suggested flow:

1. Build the prebaked image once:
   - \`docker build -t paleoclaw:qa-local-prebaked --build-arg OPENCLAW_EXTENSIONS="${QA_DOCKER_PLUGIN_SELECTION}" -f Dockerfile .\`
2. Start the stack:
   - \`docker compose -f docker-compose.qa.yml up${usePrebuiltImage ? "" : " --build"} -d\`
3. Open the QA dashboard:
   - \`http://127.0.0.1:${qaLabPort}\`
4. The single QA site embeds both panes:
   - left: Control UI
   - right: Slack-ish QA lab
5. The repo-backed kickoff task auto-injects on startup.

Fast UI refresh:

- Start once with a prebuilt image + bind-mounted QA Lab assets:
  - \`pnpm qa:lab:up --use-prebuilt-image --bind-ui-dist --skip-ui-build\`
- In another shell, rebuild the QA Lab bundle on change:
  - \`pnpm qa:lab:watch\`
- The browser auto-reloads when the QA Lab asset hash changes.

Gateway:

- health: \`http://127.0.0.1:${gatewayPort}/healthz\`
- Control UI: \`http://127.0.0.1:${gatewayPort}/\`
- Mock OpenAI: internal \`http://qa-mock-openai:44080/v1\`

This scaffold uses localhost Control UI insecure-auth compatibility for QA only.
The gateway runs with in-process restarts inside Docker so restart actions do not
kill the container by detaching a replacement child.
`,
    ],
    [path.join("state", "openclaw.json"), `${JSON.stringify(config, null, 2)}\n`],
  ] as const;

  await Promise.all(
    files.map(([name, content]) =>
      fs.writeFile(path.join(params.outputDir, name), content, "utf8"),
    ),
  );

  return {
    outputDir: params.outputDir,
    imageName,
    files: [
      ...files.map(([name]) => path.join(params.outputDir, name)),
      ...["IDENTITY.md", "QA_KICKOFF_TASK.md", "QA_SCENARIO_PLAN.md", "QA_SCENARIOS.yaml"].map(
        (name) => path.join(params.outputDir, "state", "seed-workspace", name),
      ),
    ],
  };
}

export async function buildQaDockerHarnessImage(params: { repoRoot: string; imageName?: string }) {
  const imageName = params.imageName ?? "paleoclaw:qa-local-prebaked";

  await runExec(
    "docker",
    [
      "build",
      "-t",
      imageName,
      "--build-arg",
      `OPENCLAW_EXTENSIONS=${QA_DOCKER_PLUGIN_SELECTION}`,
      "-f",
      "Dockerfile",
      ".",
    ],
    { cwd: params.repoRoot, logOutput: false },
  );

  return { imageName };
}
