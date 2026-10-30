---
name: add-model-provider
description: Add and live-prove a model provider with non-interactive config one-liners, without exposing credentials.
---

# Add a model provider

Never print or persist secret values; credentials enter config only as SecretRefs (env or file source). Never hand-edit config files on disk — every mutation goes through `paleoclaw config` so it is validated and audited. Every run ends with the observable Prove result or an exact explanation of why it could not be proven.

In-session `config_set`/`config_set_ref` tool actions are policy-blocked for `models.*` and `secrets.*`; use the trusted shell (`exec`) for the commands below. `set_default_model` is the one in-session action allowed to change the default route — it live-tests before saving.

## Gather

```
paleoclaw config get models --json          # "Config path not found" is normal before first setup
paleoclaw models list --agent <agentId>     # --agent is required in multi-agent rosters
paleoclaw models auth list --agent <agentId>
paleoclaw config schema --json | jq '.properties.models'   # confirm exact provider paths before writing
paleoclaw plugins list   # OpenAI routes need the codex harness plugin; enable/install NOW, not mid-proof
```

If the harness plugin for the target provider is missing or disabled, remediate here (`paleoclaw plugins enable codex` or `paleoclaw plugins install @paleoclaw/codex`) so the Prove step does not stall on it later; plugin enable is picked up by gateway hot-reload.

Decide the auth contract: API-key providers take a SecretRef on `models.providers.<id>.apiKey`; subscription/OAuth providers (ChatGPT/Codex, Claude subscriptions) use `paleoclaw models auth login --provider <id>` instead and must not be given an API key path.

## Mutate

API-key example (OpenAI), key staged by the operator in a `0600` file — validate first with `--dry-run`, then write:

```
paleoclaw config set secrets.providers.openai_key_file --provider-source file --provider-path /path/to/openai.key --provider-mode singleValue --dry-run
paleoclaw config set secrets.providers.openai_key_file --provider-source file --provider-path /path/to/openai.key --provider-mode singleValue
paleoclaw config set models.providers.openai.apiKey --ref-provider openai_key_file --ref-source file --ref-id value
```

Env-var alternative when the gateway process env carries the key:

```
paleoclaw config set models.providers.openai.apiKey --ref-provider default --ref-source env --ref-id OPENAI_API_KEY
```

To change a default model, use the in-session `set_default_model` action (with `agentId` for a non-default agent); it live-tests the route before saving. Do not change defaults with raw config writes.

## Repair

```
paleoclaw doctor --lint
```

`doctor --lint` can exit `1` for findings: read the report and continue the remaining checks. Ordinary `doctor` and `doctor --non-interactive` can write config/state; do not use them for diagnosis before approval. If a repair is needed, get explicit approval, run `paleoclaw doctor --fix --non-interactive`, then re-run the Gather reads.

## Prove

Roster-safe test (works in every setup; use your own agent id or any configured agent):

```
paleoclaw agent --agent <agentId> --model openai/gpt-5.4 -m "Reply with exactly: PROVIDER-PROOF-OK"
```

Single-agent installs can use the lighter completion test instead — it has no `--agent` flag and fails with "no explicit owner" on multi-agent rosters, so do not retry it there:

```
paleoclaw infer model run --gateway --model openai/gpt-5.4 --prompt "Reply with exactly: PROVIDER-PROOF-OK"
```

Expect the exact requested reply; record model id and wall time. Known dependency: OpenAI routes need the codex harness plugin at runtime — if the test reports the runtime unavailable, run `paleoclaw plugins install @paleoclaw/codex` and restart the gateway, then test again.

## Report

State the provider added, the SecretRef path written (never the value), the test result with model id and latency, and whether the default model changed. If the test failed, report the exact error and the next command to try.

Further reference: https://docs.openclaw.ai/providers/models and https://docs.openclaw.ai/providers/openai
