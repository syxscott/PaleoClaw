---
summary: "CLI reference and security model for the inference-backed paleoclaw setup and repair helper"
read_when:
  - You finished inference setup and want paleoclaw to configure the rest
  - You need to inspect or repair paleoclaw with the local setup agent
  - You are designing or enabling message-channel rescue mode
title: "paleoclaw setup agent"
---

# `paleoclaw setup`

paleoclaw ships with a built-in system agent — it speaks as "paleoclaw" — for
local setup, repair, and configuration (formerly called Crestodian). It starts only after the effective default model completes a real turn.
Fresh installs establish inference first; malformed config stays on the
classic doctor path.

## When it starts

Running `paleoclaw` with no subcommand routes based on config state:

- Config missing, or exists with no authored settings (empty, or only `$schema`/`meta` keys): starts guided onboarding with live AI verification.
- Config exists but fails validation: starts classic onboarding, which reports the issues and directs you to `paleoclaw doctor`.
- Config exists and is valid: opens the normal agent TUI. A reachable
  configured Gateway whose default agent has a model goes directly to that UI
  without onboarding or OpenClaw. Use `/paleoclaw` inside the TUI, or run
  `paleoclaw setup` directly, to reach paleoclaw later.

Running `paleoclaw setup` first live-tests the configured default model. A passing turn starts OpenClaw. An interactive failure opens guided inference setup and hands off to paleoclaw after a candidate passes. One-shot, JSON, and other noninteractive requests fail with instructions to run [`paleoclaw onboard`](/cli/onboard) when inference is unavailable. `paleoclaw --help` and `paleoclaw --version` keep their normal fast paths.

If inference plugin loading or owner verification fails, the error includes the underlying cause after applying paleoclaw's error redaction. One-shot text and JSON output retain that detail alongside onboarding guidance.

Noninteractive bare `paleoclaw` (no TTY) exits with a short message instead of printing root help: it points to non-interactive onboarding on a fresh or invalid install, or to `paleoclaw agent --local ...` when config is valid.

`paleoclaw onboard --modern` remains a compatibility alias for paleoclaw, but uses the same inference gate: working inference opens the chat, interactive failures start guided inference setup, and noninteractive failures exit with onboarding guidance. `paleoclaw onboard --classic` opens the full step-by-step wizard.

## What paleoclaw shows

Interactive paleoclaw opens the same TUI shell as `paleoclaw tui`, with an paleoclaw chat backend. The startup greeting covers:

- config validity and the default agent
- the verified model paleoclaw is using
- Gateway reachability from the first startup check
- the next recommended debug action

It does not dump secrets or load plugin CLI commands just to start.

Use `status` for the detailed inventory: config path, docs/source paths, local CLI checks, key/token presence, agents, model, and Gateway details.

paleoclaw uses the same reference discovery as regular agents: in a Git checkout it points at local `docs` and the source tree; in an npm install it uses bundled docs and links to [https://github.com/paleoclaw/paleoclaw](https://github.com/paleoclaw/paleoclaw), with guidance to check source when docs are not enough.

## Examples

```bash
paleoclaw
paleoclaw setup
paleoclaw setup --json
paleoclaw setup --message "models"
paleoclaw setup --message "validate config"
paleoclaw setup --message "setup workspace ~/path/to/work" --yes
paleoclaw setup --message "set default model openai/gpt-5.6" --yes
paleoclaw onboard --modern
```

Inside the paleoclaw TUI:

```text
status
health
doctor
validate config
setup
setup workspace ~/path/to/work
config set gateway.port 19001
config unset agents.defaults.fastModeDefault
config set-ref gateway.auth.token env OPENCLAW_GATEWAY_TOKEN
gateway status
configure gateway
open gateway wizard
restart gateway
agents
create agent work workspace ~/path/to/work
models
configure model provider
set default model openai/gpt-5.6
channels
channel info slack
connect slack
open channel wizard for slack
configure skills
configure web search
open search wizard
import memory
plugins list
plugins search slack
plugin install paleoclaw-codex-app-server
talk to work agent
talk to agent for ~/path/to/work
audit
quit
```

## Operations and approval

paleoclaw uses typed operations instead of editing config ad hoc.

For `config get`, quote record keys that contain dots or brackets, such as
`config get channels.modelByChannel.telegram["team.ops[west]"]`.
Config reads redact sensitive values before selecting the requested path.

Read-only operations run immediately: show overview, list agents, list installed plugins, search PaleoHub plugins, show model/backend status, run status/health checks, check Gateway reachability, run doctor without interactive fixes, validate config, show the audit-log path.

Starting a guided setup flow also runs immediately: channel setup (`connect telegram`), workspace skills setup (`configure skills`), web-search provider setup (`configure web search`), and local Gateway setup (`configure gateway`). Each config-backed hosted wizard collects explicit answers and owns the resulting writes; completions append audit entries and re-validate config. A web-search provider that needs a plugin install writes config only after the install succeeds — a failed or timed-out install stops setup and reports it instead of claiming the provider is configured.

`configure gateway` guides you through the local Gateway's port, bind address, token or password auth, and Tailscale exposure. It saves config without applying it to the running Gateway, because changing the active address or credential could disconnect the setup chat. Say `restart gateway` after chat setup, or run `paleoclaw gateway restart` after a terminal-wizard handoff. Remote mode is guidance-only: use `paleoclaw onboard` for a fresh setup or `paleoclaw configure` to change the mode.

`import memory` is copy-only rather than a config write. It detects supported local agent homes, lets you choose the available sources, and copies new memory files into the existing default agent workspace without importing config, credentials, or skills. It requires completed onboarding and reports confirmed imports, nothing-to-import results, provider failures, and failures where some files may already have been copied. No Gateway restart is needed. Use the Control UI's [Import Memory page](/web/control-ui/settings#import-assistant-memory) when you need to target another agent or replace an existing import.

In direct paleoclaw chat, persistent operations require conversational approval (or `--yes` for a one-shot command): write config, `config set`, `config unset`, `config set-ref`, setup/onboarding bootstrap, change the default model, start/stop/restart the Gateway, create agents, and install plugins.

Changes delegated by a regular agent, including requests from messaging channels,
follow the requesting run's effective [session permission policy](/gateway/permission-modes).
Full Access applies the exact proposed operation automatically, including when
Full Access comes from the configured default rather than an explicit session
mode. Restricted runs from messaging channels ask for approval in the chat that
made the request: channels with native approval cards show **Allow once** and
**Deny** buttons, and other messaging chats receive the change summary with a
`/approve <id> allow-once|deny` reply. Webchat and terminal runs decide in the
Control UI or the paleoclaw apps, which can also decide any chat's approval.
Replying "yes" in the delegated chat cannot authorize a change; the button or
`/approve` command does.
Channels with their own approver settings decide who may approve; elsewhere only
a current owner (`commands.ownerAllowFrom`) can approve an paleoclaw change.
Independent filesystem and sandbox boundaries,
tool policy, and the operation restrictions below still apply. The host also checks
that the requesting run and verified inference route remain valid. Interactive
setup and agent handoffs still require a direct operator session; delegated chat
cannot start a wizard, even when a model proposes it.

While a human reviews the proposal, the requesting tool stays open. **Allow once**
applies the exact proposal and returns its application outcome; **Deny** or expiry
returns a non-applied outcome instead of leaving the agent reporting a pending
change. Approval requests expire after 10 minutes without a decision. An expired
request cannot be approved: if the change is still needed, submit a fresh request
and approve it through one of the controls above. Retrying the request alone does
not grant approval.

Stopping the requesting run cancels its approval. A late approval cannot restart
a closed run. If an approved change fails to complete, check the current settings
and paleoclaw status before retrying; approval alone does not confirm that the
change was applied.

Configured agents can ask paleoclaw to create another agent through their
`paleoclaw` tool. The request enters the same typed create-agent operation and
host authorization flow; any approval summary names the requesting agent.
paleoclaw remains the executor, and authorized creation records that requesting
agent as the new agent's creator.

Delegated creation remains tied to the requesting run. If that run ends or loses
authority during preparation, paleoclaw stops before starting the next persistent
write. A write already in progress may finish, and workspace files created earlier
are not automatically removed. Check `paleoclaw agents list` before retrying from
an active run; an agent whose creation already completed is not removed when its
requesting run ends.

Doctor repairs are unavailable inside paleoclaw because they can rewrite the provider, authentication, or default-agent inference route powering the session. Exit paleoclaw and run `paleoclaw doctor --fix` in a terminal. Read-only `doctor` remains available inside OpenClaw.

New agents inherit the live-verified default inference route. The agent ids `paleoclaw` and `crestodian` are reserved for the system agent and cannot be created as normal agents. The retired id remains blocked so an old config cannot claim it.

`config set`, `config unset`, and `config set-ref` propose config changes for approval.
Use `config unset <path>` to remove an authored setting and let its inherited or
runtime default apply. The setup agent uses `config_unset` with `path` for the same
operation; setting a value to `null` does not delete it. Approved
writes use the existing config validator and writer. Validation or write errors
return to the assistant for one corrective proposal, which needs fresh approval.
A failure after saving is reported as such. Config writes do not test whether a
model route or API key works. Masked setup flows keep keys out of the model's
context. If you paste an API key or token in chat anyway, paleoclaw saves it in the
[shared secret store](/gateway/secrets/secret-store-and-egress#shared-secret-store),
points the config key at it with a `store` SecretRef, and does not echo it back.
The pasted message itself already reached the model provider and the transcript;
paleoclaw masks the value in later logs and output from that point on. Each save
creates a new entry named after the config key plus a random suffix (for example
`GATEWAY_REMOTE_TOKEN_3F9A0C1B7D2E4A68`), so it can never take over a name that
another config key, an auth profile, or a stale reference to a removed entry
still uses. paleoclaw never overwrites or deletes an existing entry: replacing a
key leaves its previous entry in the store. If the config write fails after the
key was saved, the error names the saved entry and says whether the config key
points at it. The entry is kept either way, since another config key or auth
profile may already use it: fix the error and reuse that entry rather than
pasting the key again, and remove an entry with `paleoclaw secrets store rm <NAME>`
only once nothing uses it. For environment storage, use
`config set-ref <path> env <ENV_VAR>`.
`set default model <provider/model>` still live-tests the route before saving it.

Plugin installation keeps its source restrictions. Plugin uninstall refuses a
plugin that backs the active inference route; exit paleoclaw and run
`paleoclaw plugins uninstall <id>` from a terminal.

Approval is given in your own words: unambiguous replies ("yes", "sure", "go ahead", "not now") resolve from a fixed list. When the configured route supports a separate completion call, other replies can be classified from only your message and the pending proposal — never by the conversation model itself, which cannot self-approve. Unclassified or ambiguous replies keep the proposal pending and the conversation asks again.

### Change history

The Ask paleoclaw page can show recent applied system-agent operations, Doctor
migrations, Settings and CLI config writes, and manual edits to
`openclaw.json`. The config journal detects external edits while the Gateway
is watching, during an paleoclaw-owned write, or at the next startup after an
offline edit.

History is stored in the `diagnostic_events` table of the shared
`~/.openclaw/state/openclaw.sqlite` database, under the `system-agent-audit`
and `config-audit` scopes. Each scope retains its latest 50,000 records.
Discovery and read-only operations are not included. Secrets never appear in
change history; config journal records contain changed paths rather than config
values, and value comparison uses protected fingerprints.

Config-write records retain the writer's origin label when supplied. Automatic
startup config repairs record `origin: "doctor"` even when console output and
runtime snapshot refresh are suppressed. Existing unlabeled records are not
backfilled.

Channel, web-search, and local Gateway setup can run as hosted conversations
until they reach a secret. The local paleoclaw TUI does not accept sensitive wizard answers
because terminal chat input is visible. It offers `open channel wizard`
(carrying the selected channel), `open search wizard`, or `open gateway wizard`
immediately, handing off to the masked terminal wizard; you can also run
`paleoclaw channels add --channel <channel>` or
`paleoclaw configure --section web` or `paleoclaw configure --section gateway`
later.

### Switching to a masked terminal wizard

The local chat can hand control to a masked terminal wizard:

```text
open channel wizard for slack
channel info slack
open search wizard
open gateway wizard
```

`open channel wizard for <channel>` opens masked channel setup after the chat
TUI closes. Use `channel info <channel>` first for the channel label, setup
state, prerequisites summary, and docs link. `open search wizard` works the
same way for web-search provider setup, opening the masked search wizard after
the chat TUI closes. `open gateway wizard` opens masked local Gateway setup;
when it finishes, run `paleoclaw gateway restart` to apply the saved settings.

`configure model provider` directs you to **Settings → Models → Connect provider**
without starting a wizard or changing config. Check the connected Gateway and
selected **System** or agent scope in Settings before signing in, and sign in with
the controls there. Connecting another provider
does not select it as the active model or require stopping the host. Model selection
is separate; replacing credentials for a provider already in use can affect work.

## Setup bootstrap

`setup` configures the remaining workspace and Gateway state after guided onboarding has already established inference. It writes only through typed config operations and asks for approval first.

```text
setup
setup workspace ~/path/to/work
```

`setup` preserves the verified effective model. It does not configure or
replace inference.

Delegated setup remains tied to the requesting run through configuration,
workspace, and session preparation. If that run ends or loses authority,
paleoclaw stops before starting the next persistent effect. Earlier completed
effects remain, including an agent whose creation already finished; setup may
still be incomplete. Check `paleoclaw agents list` and `status`, then request
setup again from an active run and approve the new request, or finish directly
with `paleoclaw setup` on the Gateway host. If cancellation deferred legacy
history migration for a newly named agent, the next Gateway startup retries it;
use `paleoclaw doctor --fix` on the same state/config to finish it sooner.

If inference is missing or its live check fails, leave paleoclaw and run `paleoclaw onboard`. Guided onboarding tries the configured model first, then authenticated subscription CLIs, API keys, and remaining supported CLIs; it asks each candidate for a real reply and persists only a passing route. paleoclaw starts immediately after that boundary and can then configure the workspace, Gateway, channels, agents, plugins, and other optional features.

The macOS app skips this ladder entirely when it reaches a configured Gateway
whose default agent already has a configured model; it opens the normal agent
UI.
For a fresh or incomplete Gateway, the app drives the inference ladder through
the `openclaw.setup.detect` and `openclaw.setup.activate` Gateway methods:
detect lists every candidate backend it finds, activate live-tests one
candidate (a real "reply with OK" completion), and only persists the model,
credential, and provider/runtime state needed for that route after the test passes. Workspace and Gateway defaults remain for OpenClaw. A failing candidate
never changes config; the app automatically walks down the ladder and finally
offers a manual key/token step populated from the Gateway's active
text-inference provider plugins. The selected provider owns its starter model
and config, and the credential is verified the same way before it is saved.

Codex supervision and other optional plugin features stay outside this
inference activation transaction. Configure them only after inference is
working and paleoclaw has started; existing plugin policy and explicit
supervision opt-outs remain untouched during inference setup.

## AI conversation

Interactive paleoclaw's free-form conversation runs through the same agent loop as regular paleoclaw agents, restricted to one ring-zero paleoclaw authority tool, `paleoclaw`, that wraps the typed operations. Read actions run freely, mutations require your conversational approval for that exact operation (see Operations and approval), and every applied write is audited and re-validated. The agent session persists, so paleoclaw has real multi-turn memory. If the verified inference route later stops working, return to `paleoclaw onboard` and repair it before continuing.

A failed or timed-out turn ends that setup conversation with a visible error.
Retrying starts a fresh conversation and live-checks the inference route again.

System-agent turns use `agents.defaults.timeoutSeconds`, including `0` to disable
the deadline, just like ordinary agent turns. The default is 48 hours; there is
no separate two-minute cap for setup and repair.

When a regular agent calls its `paleoclaw` tool, it delegates to this system agent
through the running Gateway rather than launching the CLI. That adds a separate
model turn, so routine session and workspace checks should use the agent's
available tools directly. The embedded system helper does not load workspace
skill catalogs because it can act only through its built-in system tool.

The host does not parse natural-language requests into operations. Free-form
messages — including command-looking text and questions such as "why did my
gateway stop?" — go to the AI, which can map the request to a typed operation
through the `paleoclaw` tool.

When a mutation is pending, only unambiguous approval or decline phrases from a
closed list are resolved without inference. Ambiguous consent goes to a
separate configured completion call; if that call cannot resolve it, the
mutation remains unapproved. Structured
wizard fields and exact host navigation are UI controls, not natural-language
operation parsing. One secret-hygiene exception is especially important: an
exact `config set` on a sensitive path (tokens, keys, passwords) never reaches
a model. The host creates a redacted proposal, and the value is masked in the
AI-visible history. Prefer `config set-ref <path> env <ENV_VAR>` for secrets.

Message-channel rescue mode never uses the model-assisted planner. Remote rescue uses fixed rules so a broken or compromised normal agent path cannot be used as a config editor.

### CLI harness trust model

Embedded runtimes and the Codex app-server harness enforce the ring-zero
restriction directly: the run carries an paleoclaw tool allow-list with only
the `paleoclaw` tool. For Codex, paleoclaw also disables environments, native
execution, multi-agent, goal, app/plugin, skill/MCP, web-search,
`request_user_input`, and its native planning utility for that run. CLI
harnesses do not consume paleoclaw's allow-list,
so paleoclaw admits only backends whose own tool-selection contract can prove
the same restriction:

- Selectable backends, including Claude Code, launch with an empty native-tool
  selection and one MCP tool, `paleoclaw`. Claude's generated MCP config is
  applied with `--strict-mcp-config`, so no other MCP servers are loaded.
- Backends that declare no native tools receive the same dedicated paleoclaw
  MCP server.
- Always-on or unknown native-tool backends are rejected before inference; they
  cannot host an paleoclaw session.

Only paleoclaw sessions get the paleoclaw MCP server; normal agent runs
never see this tool. Selectable/no-native CLI backends and API-key models
therefore enforce the literal single-tool loop. Codex app-server models enforce
a single paleoclaw authority tool plus the inert native planning utility. In all
three cases, setup writes remain confined to paleoclaw's audited approval
contract.

Gemini CLI remains available as an explicitly configured runtime for normal
agents, but Gemini CLI and Antigravity are not inference-gate setup routes.
Use AI Studio API-key or Vertex AI for the inference gate. The optional Gemini
CLI runtime specifically requires an AI Studio API-key profile.

## Switching to an agent

Use a natural-language selector to leave paleoclaw and open the normal TUI:

```text
talk to agent
talk to work agent
switch to main agent
```

`paleoclaw tui`, `paleoclaw chat`, and `paleoclaw terminal` open the normal agent TUI directly; they do not start OpenClaw. After switching into the normal TUI, `/paleoclaw` returns to paleoclaw, optionally with a follow-up request:

```text
/paleoclaw
/paleoclaw restart gateway
```

## Message rescue mode

Message rescue mode is the message-channel entrypoint for paleoclaw: use it when your normal agent is dead but a trusted channel (for example WhatsApp) still receives commands.

This is an emergency command handler based on fixed rules, not the conversational
paleoclaw agent. It does not bootstrap a fresh setup or relax the inference
gate for paleoclaw chat.

Supported command: `/paleoclaw <request>`. Rescue accepts the exact typed command grammar only — natural language is rejected with a hint, never guessed into an operation, and no model is ever consulted.

```text
You, in a trusted owner DM: /paleoclaw status
paleoclaw: paleoclaw rescue mode. Gateway reachable: no. Config valid: no.
You: /paleoclaw restart gateway
paleoclaw: Plan: restart the Gateway. Reply /paleoclaw yes to apply.
You: /paleoclaw yes
paleoclaw: Applied. Audit entry written.
```

Agent creation can also be queued locally or via rescue:

```text
create agent work workspace ~/path/to/work model openai/gpt-6-astra
/paleoclaw create agent work workspace ~/path/to/work
```

Agent creation may name only the current live-verified default model. Omit the
model to inherit that route.

Rescue approval preserves optional agent details such as
`create agent work purpose "Write release notes" workspace ~/path/to/work`.
For `set default model <provider/model> for agent work`, approval keeps the
selected agent rather than applying the change to the global default.

Remote rescue is an admin surface and must be treated like remote config repair, not normal chat.

Security contract for remote rescue:

- Disabled when sandboxing is active for the agent/session; paleoclaw refuses remote rescue and points to local CLI repair.
- Default effective state is `auto`: allow remote rescue only in trusted YOLO operation, where the runtime already has unsandboxed local authority (`tools.exec.security` resolves to `full` and `tools.exec.ask` resolves to `off`, with sandbox mode `off`).
- Requires an explicit owner identity; no wildcard sender rules, open group policy, unauthenticated webhooks, or anonymous channels.
- Rescue is limited to owner DMs.
- Plugin search and list are read-only. Plugin install is always local-only (blocked in rescue, even when otherwise enabled) because it downloads executable code. Plugin uninstall is refused in both local paleoclaw and rescue; run `paleoclaw plugins uninstall <id>` from a terminal.
- Remote rescue cannot open the local TUI or switch into an interactive agent session; use local `paleoclaw` for agent handoff.
- `config unset` is unavailable in remote rescue because that path cannot revalidate owner policy at the final write. Ask your regular agent to remove the setting through the setup helper, or run `paleoclaw config unset <path>` locally.
- Persistent writes still require approval, even in rescue mode.
- Pending approvals are one-use. Any newer rescue command for the same account, channel, and sender revokes the older plan; failed execution also consumes approval, so resend the command to retry.
- Every applied rescue operation is audited. Message-channel rescue records channel, account, sender, and source-address metadata; config-mutating operations also record config hashes before and after.
- Secrets are never echoed. SecretRef inspection reports availability, not values.
- If the Gateway is alive, rescue prefers Gateway typed operations; if it is dead, rescue uses only the minimal local repair surface that does not depend on the normal agent loop.

Rescue policy is built in: it is available only when the effective runtime is
YOLO, sandboxing is off, and the request is an owner DM. Pending write approvals
expire after 15 minutes. `paleoclaw doctor --fix` removes the retired
`systemAgent` and `crestodian` config blocks.

Remote rescue is covered by the Docker lane:

```bash
pnpm test:docker:system-agent-rescue
```

An opt-in live channel command-surface smoke checks `/paleoclaw status` plus a persistent approval roundtrip through the rescue handler:

```bash
pnpm test:live:system-agent-rescue-channel
```

Inference-gated packaged one-shot setup is covered by:

```bash
pnpm test:docker:system-agent-first-run
```

That packaged-CLI lane starts with an empty state dir and proves paleoclaw
refuses to run setup without inference. It then tests and activates fake Claude through
the packaged activation module. Only afterward does a fuzzy request reach the
planner and resolve to typed setup, followed by one-shot commands that create an
additional agent, configure Discord through a plugin enablement plus token
SecretRef, validate config, and check the audit log. This lane is supporting
gate/operation evidence; it does not exercise interactive onboarding or the
paleoclaw agent/tool/approval conversation. The QA Lab scenario below redirects
to the same Docker lane:

```bash
pnpm paleoclaw qa suite --scenario system-agent-ring-zero-setup
```

## Related

- [CLI reference](/cli)
- [Setup CLI](/cli/setup)
- [Onboard](/cli/onboard)
- [Doctor](/cli/doctor)
- [TUI](/cli/tui)
- [Sandbox](/cli/sandbox)
- [Security](/cli/security)
