---
summary: "Generated inventory of paleoclaw plugins shipped in core, published externally, or kept source-only"
read_when:
  - You are deciding whether a plugin ships in the core npm package or installs separately
  - You are updating bundled plugin package metadata or release automation
  - You need the current internal vs external plugin list
title: "Plugin inventory"
---

<!-- Generated file. Do not edit by hand.
Run `pnpm plugins:inventory:gen` to rebuild it. -->

This page lists every paleoclaw plugin with its package, install route, and
description. Operators use it to find a plugin and to see whether that plugin
needs a separate install. Maintainers use it to check bundled plugin metadata
and release automation.

## Definitions

- **Core npm package:** built into the `paleoclaw` npm package and available without a separate plugin install.
- **Official external package:** paleoclaw-maintained plugin omitted from the core npm package, kept in this official inventory, and installed on demand through PaleoHub and/or npm.
- **Source checkout only:** repo-local plugin omitted from published npm artifacts and not advertised as an installable package.

Source checkouts are different from npm installs: after `pnpm install`, bundled
plugins load from `extensions/<id>` so local edits and package-local workspace
dependencies are available.

## Install a plugin

Use the install route in each entry to decide whether install is needed. Plugins
that say `included in paleoclaw` are already present in the core package.
Official external packages need one install. Installation applies to the running
local Gateway without restarting it; start the Gateway if it was stopped.

For example, Discord is an official external package:

```bash
paleoclaw plugins install @paleoclaw/discord
paleoclaw plugins inspect discord --runtime --json
```

Package specs, including `@paleoclaw/*`, install from PaleoHub by default. Only
bare plugin ids without a version or tag retain bundled and official catalog
shortcuts. Use `PaleoHub:@paleoclaw/discord`
or `npm:@paleoclaw/discord` when you need an explicit source. After install,
follow the plugin's setup doc, such as [Discord](/channels/discord), to add
credentials and channel config. See
[Manage plugins](/plugins/manage-plugins) for update, uninstall, and publishing
commands.

Each entry lists the package, distribution route, and description.

## Core npm package

73 plugins

- **[a2a](/plugins/reference/a2a)** (`@paleoclaw/a2a`) - included in OpenClaw. A2A v1.0 Agent-to-Agent protocol channel plugin.

- **[active-memory](/plugins/reference/active-memory)** (`paleoclaw`) - included in OpenClaw. Runs bounded pre-reply memory retrieval and implements per-agent Remember across conversations for eligible private conversations.

- **[admin-http-rpc](/plugins/reference/admin-http-rpc)** (`@paleoclaw/admin-http-rpc`) - included in OpenClaw. paleoclaw admin HTTP RPC endpoint.

- **[advisor](/plugins/reference/advisor)** (`@paleoclaw/advisor`) - included in OpenClaw. Experimental: reviews ongoing agent work on the session's own model and offers one short correction.

- **[agent-guidance](/plugins/reference/agent-guidance)** (`@paleoclaw/agent-guidance`) - included in OpenClaw. Shares instruction files across selected agents without editing their workspace files.

- **[agentsapi](/plugins/reference/agentsapi)** (`@paleoclaw/agentsapi`) - included in OpenClaw. OpenAI Agents API harness with hosted or self-hosted sessions.

- **[alibaba](/plugins/reference/alibaba)** (`@paleoclaw/alibaba-provider`) - included in OpenClaw. Adds video generation provider support.

- **[anthropic](/plugins/reference/anthropic)** (`@paleoclaw/anthropic-provider`) - included in OpenClaw. Anthropic models, Claude CLI, and native Claude session catalog.

- **[apple-fm](/plugins/reference/apple-fm)** (`@paleoclaw/apple-fm-provider`) - included in OpenClaw. On-device Apple Intelligence inference for lightweight setup and short tasks.

- **[autoreview](/plugins/reference/autoreview)** (`@paleoclaw/autoreview`) - included in OpenClaw. Review changes in the current sandbox with the installed Auto Review helper.

- **[azure-speech](/plugins/reference/azure-speech)** (`@paleoclaw/azure-speech`) - included in OpenClaw. Azure AI Speech text-to-speech (MP3, native Ogg/Opus voice notes, PCM telephony).

- **[beam](/plugins/reference/beam)** (`@paleoclaw/beam`) - included in OpenClaw. Read-only coding-session Beam receiver.

- **[bifrost](/plugins/reference/bifrost)** (`@paleoclaw/bifrost-provider`) - included in OpenClaw. Adds Bifrost model provider support to OpenClaw.

- **[bonjour](/plugins/reference/bonjour)** (`@paleoclaw/bonjour`) - included in OpenClaw. Advertise the local paleoclaw gateway over Bonjour/mDNS.

- **[browser](/plugins/reference/browser)** (`@paleoclaw/browser-plugin`) - included in OpenClaw. Adds agent-callable tools.

- **[canvas](/plugins/reference/canvas)** (`@paleoclaw/canvas-plugin`) - included in OpenClaw. Presents hosted widget documents on paired macOS panels.

- **[clawrouter](/plugins/reference/clawrouter)** (`@paleoclaw/clawrouter`) - included in OpenClaw. Adds ClawRouter model provider support to OpenClaw.

- **[cloudflare](/plugins/reference/cloudflare)** (`@paleoclaw/cloudflare`) - included in paleoclaw, and also from npm or PaleoHub: `@paleoclaw/cloudflare`. Cloudflare R2 storage for named paleoclaw storage locations.

- **[code-mode-quickjs](/plugins/reference/code-mode-quickjs)** (`@paleoclaw/code-mode-quickjs`) - included in OpenClaw. Hardened JavaScript execution for Code Mode using QuickJS in WebAssembly.

- **[copilot-proxy](/plugins/reference/copilot-proxy)** (`@paleoclaw/copilot-proxy`) - included in OpenClaw. Adds Copilot Proxy model provider support to OpenClaw.

- **[crabbox](/plugins/reference/crabbox)** (`@paleoclaw/crabbox-provider`) - included in OpenClaw. Cloud worker provider and lease-backed sandbox backend for the Crabbox CLI.

- **[cua-computer](/plugins/reference/cua-computer)** (`@paleoclaw/cua-computer`) - included in OpenClaw. Experimental CUA Driver computer control for macOS, Windows, and Linux node hosts.

- **[deepgram](/plugins/reference/deepgram)** (`@paleoclaw/deepgram-provider`) - included in OpenClaw. Deepgram audio transcription with Nova and Flux models, plus realtime speech recognition.

- **[device-pair](/plugins/reference/device-pair)** (`paleoclaw`) - included in OpenClaw. Generate setup codes and approve device pairing requests.

- **[document-extract](/plugins/reference/document-extract)** (`@paleoclaw/document-extract-plugin`) - included in OpenClaw. Extract text and fallback page images from local document attachments.

- **[elevenlabs](/plugins/reference/elevenlabs)** (`@paleoclaw/elevenlabs-speech`) - included in OpenClaw. Adds media understanding provider support. Adds realtime transcription provider support. Adds text-to-speech provider support.

- **[fal](/plugins/reference/fal)** (`@paleoclaw/fal-provider`) - included in OpenClaw. Adds fal model provider support to OpenClaw.

- **[file-transfer](/plugins/reference/file-transfer)** (`@paleoclaw/file-transfer`) - included in OpenClaw. Fetch, list, and write files on paired nodes via dedicated node commands. Bypasses bash stdout truncation by using base64 over node.invoke for binaries up to 16 MB.

- **[geolocation](/plugins/reference/geolocation)** (`@paleoclaw/geolocation-plugin`) - included in OpenClaw. Resolves client IP addresses to a coarse city using a locally cached IP-geolocation database.

- **[github](/plugins/reference/github)** (`@paleoclaw/github`) - included in OpenClaw. Public GitHub link previews and document reader.

- **[github-copilot](/plugins/reference/github-copilot)** (`@paleoclaw/github-copilot-provider`) - included in OpenClaw. Adds GitHub Copilot model provider support to OpenClaw.

- **[google](/plugins/reference/google)** (`@paleoclaw/google-plugin`) - included in OpenClaw. Adds Google, Google Gemini CLI, Google Vertex model provider support to OpenClaw.

- **[huggingface](/plugins/reference/huggingface)** (`@paleoclaw/huggingface-provider`) - included in OpenClaw. Adds Hugging Face model provider support to OpenClaw.

- **[imap](/plugins/reference/imap)** (`@paleoclaw/imap`) - included in OpenClaw. Watch IMAP mailboxes and dispatch authenticated incoming email to isolated agent sessions.

- **[kie](/plugins/reference/kie)** (`@paleoclaw/kie-provider`) - included in OpenClaw. Adds Kie model provider support to OpenClaw.

- **[linux-node](/plugins/reference/linux-node)** (`@paleoclaw/linux-node`) - included in OpenClaw. Desktop notifications, camera capture, and location for Linux node hosts.

- **[litellm](/plugins/reference/litellm)** (`@paleoclaw/litellm-provider`) - included in OpenClaw. Adds LiteLLM model provider support to OpenClaw.

- **[llm-task](/plugins/reference/llm-task)** (`@paleoclaw/llm-task`) - included in OpenClaw. Generic JSON-only LLM tool for structured tasks callable from workflows.

- **[lmstudio](/plugins/reference/lmstudio)** (`@paleoclaw/lmstudio-provider`) - included in OpenClaw. Adds LM Studio model provider support to OpenClaw.

- **[logbook](/plugins/reference/logbook)** (`@paleoclaw/logbook`) - included in OpenClaw. Automatic work journal: captures periodic screen snapshots from a paired node and turns them into a reviewable timeline of your day.

- **[mcp-events](/plugins/reference/mcp-events)** (`@paleoclaw/mcp-events`) - included in OpenClaw. Subscribe to events from configured MCP accounts and trigger authored automations.

- **[mcp-relay](/plugins/reference/mcp-relay)** (`@paleoclaw/mcp-relay`) - included in OpenClaw. Connect remote MCP clients to your paleoclaw Gateway.

- **[memory-core](/plugins/reference/memory-core)** (`@paleoclaw/memory-core`) - included in OpenClaw. Adds agent-callable tools.

- **[memory-wiki](/plugins/reference/memory-wiki)** (`@paleoclaw/memory-wiki`) - included in OpenClaw. Persistent wiki compiler and Obsidian-friendly knowledge vault for OpenClaw.

- **[microsoft](/plugins/reference/microsoft)** (`@paleoclaw/microsoft-speech`) - included in OpenClaw. Adds text-to-speech provider support.

- **[microsoft-foundry](/plugins/reference/microsoft-foundry)** (`@paleoclaw/microsoft-foundry`) - included in OpenClaw. Adds Microsoft Foundry model provider support to OpenClaw.

- **[migrate-claude](/plugins/reference/migrate-claude)** (`@paleoclaw/migrate-claude`) - included in OpenClaw. Imports Claude Code and Claude Desktop instructions, MCP servers, skills, and safe configuration into OpenClaw.

- **[migrate-hermes](/plugins/reference/migrate-hermes)** (`@paleoclaw/migrate-hermes`) - included in OpenClaw. Imports Hermes configuration, memories, skills, and supported credentials into OpenClaw.

- **[minimax](/plugins/reference/minimax)** (`@paleoclaw/minimax-provider`) - included in OpenClaw. Adds MiniMax, MiniMax Portal model provider support to OpenClaw.

- **[nvidia](/plugins/reference/nvidia)** (`@paleoclaw/nvidia-provider`) - included in OpenClaw. Adds NVIDIA model provider support to OpenClaw.

- **[oc-path](/plugins/reference/oc-path)** (`@paleoclaw/oc-path`) - included in OpenClaw. Adds the paleoclaw path CLI for oc:// workspace file addressing.

- **[ollama](/plugins/reference/ollama)** (`@paleoclaw/ollama-provider`) - included in OpenClaw. Adds Ollama, Ollama Cloud model provider support to OpenClaw.

- **[omlx](/plugins/reference/omlx)** (`@paleoclaw/omlx-provider`) - included in OpenClaw. Adds Omlx model provider support to OpenClaw.

- **[onepassword](/plugins/reference/onepassword)** (`@paleoclaw/onepassword`) - included in OpenClaw. 1Password SecretRef resolver and curated agent broker with approval policy and SQLite audit history.

- **[openai](/plugins/reference/openai)** (`@paleoclaw/openai-provider`) - included in OpenClaw. Adds OpenAI model provider support to OpenClaw.

- **[opencode-go](/plugins/reference/opencode-go)** (`@paleoclaw/opencode-go-provider`) - included in OpenClaw. Adds OpenCode Go model provider support to OpenClaw.

- **[openrouter](/plugins/reference/openrouter)** (`@paleoclaw/openrouter-provider`) - included in OpenClaw. Adds OpenRouter model provider support to OpenClaw.

- **[policy](/plugins/reference/policy)** (`@paleoclaw/policy`) - included in OpenClaw. Adds policy-backed doctor checks for workspace conformance.

- **[reef](/plugins/reference/reef)** (`@paleoclaw/reef`) - included in OpenClaw. Guarded end-to-end encrypted claw channel.

- **[runway](/plugins/reference/runway)** (`@paleoclaw/runway-provider`) - included in OpenClaw. Adds video generation provider support.

- **[senseaudio](/plugins/reference/senseaudio)** (`@paleoclaw/senseaudio-provider`) - included in OpenClaw. Adds media understanding provider support.

- **[session-share](/plugins/reference/session-share)** (`@paleoclaw/session-share`) - included in OpenClaw. Read-only paleoclaw sessions on paired gateways.

- **[sglang](/plugins/reference/sglang)** (`@paleoclaw/sglang-provider`) - included in OpenClaw. Adds SGLang model provider support to OpenClaw.

- **[talk-voice](/plugins/reference/talk-voice)** (`paleoclaw`) - included in OpenClaw. Manage Talk voice selection (list/set).

- **[telegram](/plugins/reference/telegram)** (`@paleoclaw/telegram`) - included in OpenClaw. paleoclaw Telegram channel plugin.

- **[together](/plugins/reference/together)** (`@paleoclaw/together-provider`) - included in OpenClaw. Adds Together model provider support to OpenClaw.

- **[tts-local-cli](/plugins/reference/tts-local-cli)** (`@paleoclaw/tts-local-cli`) - included in OpenClaw. Adds text-to-speech provider support.

- **[vault](/plugins/reference/vault)** (`@paleoclaw/vault`) - included in OpenClaw. HashiCorp Vault SecretRef provider integration.

- **[vllm](/plugins/reference/vllm)** (`@paleoclaw/vllm-provider`) - included in OpenClaw. Adds vLLM model provider support to OpenClaw.

- **[web-readability](/plugins/reference/web-readability)** (`@paleoclaw/web-readability-plugin`) - included in OpenClaw. Extract readable article content from local HTML web fetch responses.

- **[workboard](/plugins/reference/workboard)** (`@paleoclaw/workboard`) - included in OpenClaw. Dashboard workboard for agent-owned issues and sessions.

- **[x](/plugins/reference/x)** (`@paleoclaw/x`) - included in OpenClaw. Allowlisted X mentions and public replies.

- **[xai](/plugins/reference/xai)** (`@paleoclaw/xai-plugin`) - included in OpenClaw. xAI provider for Grok models, Grok web and X search, code execution, speech, and media generation.

## Official external packages

99 plugins

- **[acpx](/plugins/reference/acpx)** (`@paleoclaw/acpx`) - npm or PaleoHub: `@paleoclaw/acpx`. paleoclaw ACP runtime backend with plugin-owned session and transport management.

- **[amazon-bedrock](/plugins/reference/amazon-bedrock)** (`@paleoclaw/amazon-bedrock-provider`) - npm or PaleoHub: `@paleoclaw/amazon-bedrock-provider`. paleoclaw Amazon Bedrock provider plugin with model discovery, embeddings, and guardrail support.

- **[amazon-bedrock-mantle](/plugins/reference/amazon-bedrock-mantle)** (`@paleoclaw/amazon-bedrock-mantle-provider`) - npm or PaleoHub: `@paleoclaw/amazon-bedrock-mantle-provider`. paleoclaw Amazon Bedrock Mantle provider plugin for OpenAI-compatible model routing.

- **[anthropic-vertex](/plugins/reference/anthropic-vertex)** (`@paleoclaw/anthropic-vertex-provider`) - npm or PaleoHub: `@paleoclaw/anthropic-vertex-provider`. paleoclaw Anthropic Vertex provider plugin for Claude models on Google Vertex AI.

- **[arcee](/plugins/reference/arcee)** (`@paleoclaw/arcee-provider`) - npm or PaleoHub: `@paleoclaw/arcee-provider`. Adds Arcee model provider support to OpenClaw.

- **[baseten](/plugins/reference/baseten)** (`@paleoclaw/baseten-provider`) - npm or PaleoHub: `@paleoclaw/baseten-provider`. paleoclaw Baseten provider plugin.

- **[brave](/plugins/reference/brave)** (`@paleoclaw/brave-plugin`) - npm or PaleoHub: `@paleoclaw/brave-plugin`. paleoclaw Brave Search provider plugin for web search.

- **[buzz](/plugins/reference/buzz)** (`@paleoclaw/buzz`) - npm or PaleoHub: `@paleoclaw/buzz`. Connect paleoclaw agents to Buzz rooms.

- **[byteplus](/plugins/reference/byteplus)** (`@paleoclaw/byteplus-provider`) - npm or PaleoHub: `@paleoclaw/byteplus-provider`. Adds BytePlus, BytePlus Plan model provider support to OpenClaw.

- **[cerebras](/plugins/reference/cerebras)** (`@paleoclaw/cerebras-provider`) - npm or PaleoHub: `@paleoclaw/cerebras-provider`. Adds Cerebras model provider support to OpenClaw.

- **[chutes](/plugins/reference/chutes)** (`@paleoclaw/chutes-provider`) - npm or PaleoHub: `@paleoclaw/chutes-provider`. Adds Chutes model provider support to OpenClaw.

- **[clickclack](/plugins/reference/clickclack)** (`@paleoclaw/clickclack`) - npm or PaleoHub: `@paleoclaw/clickclack`. paleoclaw ClickClack channel plugin.

- **[cloudflare-ai-gateway](/plugins/reference/cloudflare-ai-gateway)** (`@paleoclaw/cloudflare-ai-gateway-provider`) - npm or PaleoHub: `@paleoclaw/cloudflare-ai-gateway-provider`. Adds Cloudflare AI Gateway model provider support to OpenClaw.

- **[codex](/plugins/reference/codex)** (`@paleoclaw/codex`) - npm or PaleoHub: `@paleoclaw/codex`. Codex app-server harness and native session catalog.

- **[cohere](/plugins/reference/cohere)** (`@paleoclaw/cohere-provider`) - npm or PaleoHub: `@paleoclaw/cohere-provider`. paleoclaw Cohere provider plugin.

- **[comfy](/plugins/reference/comfy)** (`@paleoclaw/comfy-provider`) - npm or PaleoHub: `@paleoclaw/comfy-provider`. Adds ComfyUI model provider support to OpenClaw.

- **[copilot](/plugins/reference/copilot)** (`@paleoclaw/copilot`) - npm or PaleoHub: `@paleoclaw/copilot`. Registers the GitHub Copilot agent runtime.

- **[deepinfra](/plugins/reference/deepinfra)** (`@paleoclaw/deepinfra-provider`) - npm or PaleoHub: `@paleoclaw/deepinfra-provider`. Adds DeepInfra model provider support to OpenClaw.

- **[deepseek](/plugins/reference/deepseek)** (`@paleoclaw/deepseek-provider`) - npm or PaleoHub: `@paleoclaw/deepseek-provider`. Adds DeepSeek model provider support to OpenClaw.

- **[diagnostics-otel](/plugins/reference/diagnostics-otel)** (`@paleoclaw/diagnostics-otel`) - npm or PaleoHub: `@paleoclaw/diagnostics-otel`. paleoclaw diagnostics OpenTelemetry exporter for metrics, traces, and logs.

- **[diagnostics-prometheus](/plugins/reference/diagnostics-prometheus)** (`@paleoclaw/diagnostics-prometheus`) - npm or PaleoHub: `@paleoclaw/diagnostics-prometheus`. paleoclaw diagnostics Prometheus exporter for runtime metrics.

- **[diffs](/plugins/reference/diffs)** (`@paleoclaw/diffs`) - npm or PaleoHub: `@paleoclaw/diffs`. paleoclaw read-only diff viewer plugin and file renderer for agents.

- **[diffs-language-pack](/plugins/reference/diffs-language-pack)** (`@paleoclaw/diffs-language-pack`) - npm or PaleoHub: `@paleoclaw/diffs-language-pack`. Adds syntax highlighting for languages outside the default diffs viewer set.

- **[discord](/plugins/reference/discord)** (`@paleoclaw/discord`) - npm or PaleoHub: `@paleoclaw/discord`. paleoclaw Discord channel plugin for channels, DMs, commands, and app events.

- **[duckduckgo](/plugins/reference/duckduckgo)** (`@paleoclaw/duckduckgo-plugin`) - npm or PaleoHub: `@paleoclaw/duckduckgo-plugin`. Adds web search provider support.

- **[exa](/plugins/reference/exa)** (`@paleoclaw/exa-plugin`) - npm or PaleoHub: `@paleoclaw/exa-plugin`. Adds web search provider support.

- **[facetime](/plugins/reference/facetime)** (`@paleoclaw/facetime`) - npm or PaleoHub: `@paleoclaw/facetime`. Experimental FaceTime realtime voice carrier for paleoclaw agents.

- **[featherless](/plugins/reference/featherless)** (`@paleoclaw/featherless-provider`) - npm or PaleoHub: `@paleoclaw/featherless-provider`. paleoclaw Featherless AI provider plugin.

- **[feishu](/plugins/reference/feishu)** (`@paleoclaw/feishu`) - npm or PaleoHub: `@paleoclaw/feishu`. paleoclaw Feishu/Lark channel plugin for chats and workplace tools (community maintained by @m1heng).

- **[firecrawl](/plugins/reference/firecrawl)** (`@paleoclaw/firecrawl-plugin`) - npm or PaleoHub: `@paleoclaw/firecrawl-plugin`. Adds agent-callable tools. Adds web fetch provider support. Adds web search provider support.

- **[fireworks](/plugins/reference/fireworks)** (`@paleoclaw/fireworks-provider`) - npm or PaleoHub: `@paleoclaw/fireworks-provider`. Adds Fireworks model provider support to OpenClaw.

- **[fish-audio-speech](/plugins/reference/fish-audio-speech)** (`@paleoclaw/fish-audio-speech`) - npm or PaleoHub: `@paleoclaw/fish-audio-speech`. Fish Audio hosted text-to-speech with streaming, voice notes, and telephony output.

- **[gmi](/plugins/reference/gmi)** (`@paleoclaw/gmi-provider`) - npm or PaleoHub: `@paleoclaw/gmi-provider`. paleoclaw GMI Cloud provider plugin.

- **[google-meet](/plugins/reference/google-meet)** (`@paleoclaw/google-meet`) - npm or PaleoHub: `@paleoclaw/google-meet`. paleoclaw Google Meet participant plugin for joining calls through Chrome or Twilio transports.

- **[googlechat](/plugins/reference/googlechat)** (`@paleoclaw/googlechat`) - npm or PaleoHub: `@paleoclaw/googlechat`. paleoclaw Google Chat channel plugin for spaces and direct messages.

- **[gradium](/plugins/reference/gradium)** (`@paleoclaw/gradium-speech`) - npm or PaleoHub: `@paleoclaw/gradium-speech`. Adds text-to-speech provider support.

- **[groq](/plugins/reference/groq)** (`@paleoclaw/groq-provider`) - npm or PaleoHub: `@paleoclaw/groq-provider`. Adds Groq model provider support to OpenClaw.

- **[imessage](/plugins/reference/imessage)** (`@paleoclaw/imessage`) - npm or PaleoHub: `@paleoclaw/imessage`. paleoclaw iMessage channel plugin using imsg on a signed-in Mac.

- **[inworld](/plugins/reference/inworld)** (`@paleoclaw/inworld-speech`) - npm or PaleoHub: `@paleoclaw/inworld-speech`. Inworld streaming text-to-speech (MP3, OGG_OPUS, PCM telephony).

- **[irc](/plugins/reference/irc)** (`@paleoclaw/irc`) - npm or PaleoHub: `@paleoclaw/irc`. paleoclaw IRC channel plugin.

- **[kilocode](/plugins/reference/kilocode)** (`@paleoclaw/kilocode-provider`) - npm or PaleoHub: `@paleoclaw/kilocode-provider`. Adds Kilocode model provider support to OpenClaw.

- **[kimi](/plugins/reference/kimi)** (`@paleoclaw/kimi-provider`) - npm or PaleoHub: `@paleoclaw/kimi-provider`. Adds Kimi, Kimi Code, Kimi Coding model provider support to OpenClaw.

- **[levanto](/plugins/reference/levanto)** (`@paleoclaw/levanto`) - npm or PaleoHub: `@paleoclaw/levanto`. Native Yes/No, Choice, Scale, Sort, and Tags decisions with explicit abstention.

- **[line](/plugins/reference/line)** (`@paleoclaw/line`) - npm or PaleoHub: `@paleoclaw/line`. paleoclaw LINE channel plugin for LINE Bot API chats.

- **[llama-cpp](/plugins/reference/llama-cpp)** (`@paleoclaw/llama-cpp-provider`) - npm or PaleoHub: `@paleoclaw/llama-cpp-provider`. Managed and external llama.cpp servers for GGUF chat, embeddings and local images.

- **[lobster](/plugins/reference/lobster)** (`@paleoclaw/lobster`) - npm or PaleoHub: `@paleoclaw/lobster`. Lobster workflow tool plugin for typed pipelines and resumable approvals.

- **[longcat](/plugins/reference/longcat)** (`@paleoclaw/longcat-provider`) - npm or PaleoHub: `@paleoclaw/longcat-provider`. paleoclaw LongCat provider plugin.

- **[matrix](/plugins/reference/matrix)** (`@paleoclaw/matrix`) - npm or PaleoHub: `@paleoclaw/matrix`. paleoclaw Matrix channel plugin for rooms and direct messages.

- **[mattermost](/plugins/reference/mattermost)** (`@paleoclaw/mattermost`) - npm or PaleoHub: `@paleoclaw/mattermost`. paleoclaw Mattermost channel plugin.

- **[memory-lancedb](/plugins/reference/memory-lancedb)** (`@paleoclaw/memory-lancedb`) - npm or PaleoHub: `@paleoclaw/memory-lancedb`. paleoclaw LanceDB-backed long-term memory plugin with auto-recall, auto-capture, and vector search.

- **[meta](/plugins/reference/meta)** (`@paleoclaw/meta-provider`) - npm or PaleoHub: `@paleoclaw/meta-provider`. Adds Meta model provider support to OpenClaw.

- **[mistral](/plugins/reference/mistral)** (`@paleoclaw/mistral-provider`) - npm or PaleoHub: `@paleoclaw/mistral-provider`. Adds Mistral model provider support to OpenClaw.

- **[moonshot](/plugins/reference/moonshot)** (`@paleoclaw/moonshot-provider`) - npm or PaleoHub: `@paleoclaw/moonshot-provider`. Adds Moonshot model provider support to OpenClaw.

- **[msteams](/plugins/reference/msteams)** (`@paleoclaw/msteams`) - npm or PaleoHub: `@paleoclaw/msteams`. paleoclaw Microsoft Teams channel plugin for bot conversations.

- **[muse](/plugins/reference/muse)** (`@paleoclaw/muse`) - npm or PaleoHub: `@paleoclaw/muse`. Runs Meta models through the Muse Code CLI.

- **[mxc](/plugins/reference/mxc)** (`@paleoclaw/mxc-sandbox`) - npm or PaleoHub: `@paleoclaw/mxc-sandbox`. OS-level sandboxed tool execution via MXC: runs commands in a Windows ProcessContainer with configured MXC policy files.

- **[nextcloud-talk](/plugins/reference/nextcloud-talk)** (`@paleoclaw/nextcloud-talk`) - npm or PaleoHub: `@paleoclaw/nextcloud-talk`. paleoclaw Nextcloud Talk channel plugin for conversations.

- **[nostr](/plugins/reference/nostr)** (`@paleoclaw/nostr`) - npm or PaleoHub: `@paleoclaw/nostr`. paleoclaw Nostr channel plugin for NIP-04 encrypted direct messages.

- **[novita](/plugins/reference/novita)** (`@paleoclaw/novita-provider`) - npm or PaleoHub: `@paleoclaw/novita-provider`. Adds Novita, Novita AI, Novitaai model provider support to OpenClaw.

- **[onnx](/plugins/reference/onnx)** (`@paleoclaw/onnx`) - npm or PaleoHub: `@paleoclaw/onnx`. Local typed decisions using pinned ONNX classifiers.

- **[opencode](/plugins/reference/opencode)** (`@paleoclaw/opencode-provider`) - npm or PaleoHub: `@paleoclaw/opencode-provider`. Adds OpenCode model provider support to OpenClaw.

- **[openshell](/plugins/reference/openshell)** (`@paleoclaw/openshell-sandbox`) - npm or PaleoHub: `@paleoclaw/openshell-sandbox`. paleoclaw sandbox backend for the NVIDIA OpenShell CLI with mirrored local workspaces and SSH command execution.

- **[parallel](/tools/parallel-search)** (`@paleoclaw/parallel-plugin`) - npm or PaleoHub: `@paleoclaw/parallel-plugin`. Adds web search provider support.

- **[perplexity](/plugins/reference/perplexity)** (`@paleoclaw/perplexity-plugin`) - npm or PaleoHub: `@paleoclaw/perplexity-plugin`. Adds web search provider support.

- **[pixverse](/plugins/reference/pixverse)** (`@paleoclaw/pixverse-provider`) - npm or PaleoHub: `@paleoclaw/pixverse-provider`. paleoclaw PixVerse video generation provider plugin.

- **[qianfan](/plugins/reference/qianfan)** (`@paleoclaw/qianfan-provider`) - npm or PaleoHub: `@paleoclaw/qianfan-provider`. Adds Qianfan model provider support to OpenClaw.

- **[qqbot](/plugins/reference/qqbot)** (`@tencent-connect/paleoclaw-qqbot`) - npm. paleoclaw QQ Bot channel plugin for group and direct-message workflows.

- **[qwen](/plugins/reference/qwen)** (`@paleoclaw/qwen-provider`) - npm or PaleoHub: `@paleoclaw/qwen-provider`. Adds Qwen, Qwen Cloud, Model Studio, DashScope, Qwen Token Plan, Bailian Token Plan model provider support to OpenClaw.

- **[radius](/plugins/reference/radius)** (`@paleoclaw/radius-provider`) - npm or PaleoHub: `@paleoclaw/radius-provider`. Radius model gateway provider.

- **[raft](/plugins/reference/raft)** (`@paleoclaw/raft`) - npm or PaleoHub: `@paleoclaw/raft`. paleoclaw Raft channel plugin for secure CLI wake bridges.

- **[searxng](/plugins/reference/searxng)** (`@paleoclaw/searxng-plugin`) - npm or PaleoHub: `@paleoclaw/searxng-plugin`. Adds web search provider support.

- **[signal](/plugins/reference/signal)** (`@paleoclaw/signal`) - npm or PaleoHub: `@paleoclaw/signal`. paleoclaw Signal channel plugin.

- **[slack](/plugins/reference/slack)** (`@paleoclaw/slack`) - npm or PaleoHub: `@paleoclaw/slack`. paleoclaw Slack channel plugin for channels, DMs, commands, and app events.

- **[slack-huddles](/plugins/reference/slack-huddles)** (`@paleoclaw/slack-huddles`) - npm or PaleoHub: `@paleoclaw/slack-huddles`. Join Slack huddles through a dedicated Slack user in Chrome.

- **[sms](/plugins/reference/sms)** (`@paleoclaw/sms`) - npm or PaleoHub: `@paleoclaw/sms`. Twilio SMS/MMS channel plugin for paleoclaw messages.

- **[stepfun](/plugins/reference/stepfun)** (`@paleoclaw/stepfun-provider`) - npm or PaleoHub: `@paleoclaw/stepfun-provider`. Adds StepFun, StepFun Plan model provider support to OpenClaw.

- **[subq](/plugins/reference/subq)** (`@paleoclaw/subq`) - npm or PaleoHub: `@paleoclaw/subq`. SubQ Snap typed decisions (not a conversational model).

- **[synology-chat](/plugins/reference/synology-chat)** (`@paleoclaw/synology-chat`) - npm or PaleoHub: `@paleoclaw/synology-chat`. Synology Chat channel plugin for paleoclaw channels and direct messages.

- **[synthetic](/plugins/reference/synthetic)** (`@paleoclaw/synthetic-provider`) - npm or PaleoHub: `@paleoclaw/synthetic-provider`. Adds Synthetic model provider support to OpenClaw.

- **[tavily](/plugins/reference/tavily)** (`@paleoclaw/tavily-plugin`) - npm or PaleoHub: `@paleoclaw/tavily-plugin`. Adds agent-callable tools. Adds web search provider support.

- **[team-reports](/plugins/reference/team-reports)** (`@paleoclaw/team-reports`) - npm or PaleoHub: `@paleoclaw/team-reports`. Daily, weekly, and monthly team activity reports from GitHub and Discord, with model-written summaries, served in the Control UI.

- **[teams-meetings](/plugins/reference/teams-meetings)** (`@paleoclaw/teams-meetings`) - npm or PaleoHub: `@paleoclaw/teams-meetings`. Join Microsoft Teams meetings as a Chrome browser guest.

- **[tencent](/plugins/reference/tencent)** (`@paleoclaw/tencent-provider`) - npm or PaleoHub: `@paleoclaw/tencent-provider`. Adds Tencent TokenHub, Tencent Tokenplan model provider support to OpenClaw.

- **[tlon](/plugins/reference/tlon)** (`@paleoclaw/tlon`) - npm or PaleoHub: `@paleoclaw/tlon`. paleoclaw Tlon/Urbit channel plugin for chat workflows.

- **[tokenjuice](/plugins/reference/tokenjuice)** (`@paleoclaw/tokenjuice`) - npm or PaleoHub: `@paleoclaw/tokenjuice`. Compacts exec and bash tool results with tokenjuice reducers.

- **[twitch](/plugins/reference/twitch)** (`@paleoclaw/twitch`) - npm or PaleoHub: `@paleoclaw/twitch`. paleoclaw Twitch channel plugin for chat and moderation workflows.

- **[typesafe](/plugins/reference/typesafe)** (`@paleoclaw/typesafe`) - npm or PaleoHub: `@paleoclaw/typesafe`. Typed decision provider for hosted Jev and local System One models.

- **[venice](/plugins/reference/venice)** (`@paleoclaw/venice-provider`) - npm or PaleoHub: `@paleoclaw/venice-provider`. Adds Venice model provider support to OpenClaw.

- **[vercel-ai-gateway](/plugins/reference/vercel-ai-gateway)** (`@paleoclaw/vercel-ai-gateway-provider`) - npm or PaleoHub: `@paleoclaw/vercel-ai-gateway-provider`. Adds Vercel AI Gateway model provider support to OpenClaw.

- **[voice-call](/plugins/reference/voice-call)** (`@paleoclaw/voice-call`) - npm or PaleoHub: `@paleoclaw/voice-call`. paleoclaw voice-call plugin for Twilio, Telnyx, and Plivo phone calls.

- **[volcengine](/plugins/reference/volcengine)** (`@paleoclaw/volcengine-provider`) - npm or PaleoHub: `@paleoclaw/volcengine-provider`. Adds Volcengine, Volcengine Plan model provider support to OpenClaw.

- **[voyage](/plugins/reference/voyage)** (`@paleoclaw/voyage-provider`) - npm or PaleoHub: `@paleoclaw/voyage-provider`. Adds embedding provider support, including memory search.

- **[vydra](/plugins/reference/vydra)** (`@paleoclaw/vydra-provider`) - npm or PaleoHub: `@paleoclaw/vydra-provider`. Adds Vydra model provider support to OpenClaw.

- **[whatsapp](/plugins/reference/whatsapp)** (`@paleoclaw/whatsapp`) - npm or PaleoHub: `@paleoclaw/whatsapp`. paleoclaw WhatsApp channel plugin for WhatsApp Web chats.

- **[xiaomi](/plugins/reference/xiaomi)** (`@paleoclaw/xiaomi-provider`) - npm or PaleoHub: `@paleoclaw/xiaomi-provider`. Adds Xiaomi, Xiaomi Token Plan model provider support to OpenClaw.

- **[zai](/plugins/reference/zai)** (`@paleoclaw/zai-provider`) - npm or PaleoHub: `@paleoclaw/zai-provider`. Adds Z.AI model provider support to OpenClaw.

- **[zalo](/plugins/reference/zalo)** (`@paleoclaw/zalo`) - npm or PaleoHub: `@paleoclaw/zalo`. paleoclaw Zalo channel plugin for bot and webhook chats.

- **[zalouser](/plugins/reference/zalouser)** (`@paleoclaw/zalouser`) - npm or PaleoHub: `@paleoclaw/zalouser`. paleoclaw Zalo Personal Account plugin via native zca-js integration.

- **[zoom-meetings](/plugins/reference/zoom-meetings)** (`@paleoclaw/zoom-meetings`) - npm or PaleoHub: `@paleoclaw/zoom-meetings`. Join Zoom meetings as a Chrome browser guest.

## Source checkout only

3 plugins

- **[qa-channel](/plugins/reference/qa-channel)** (`@paleoclaw/qa-channel`) - source checkout only. paleoclaw QA synthetic channel plugin.

- **[qa-lab](/plugins/reference/qa-lab)** (`@paleoclaw/qa-lab`) - source checkout only. paleoclaw QA lab plugin with private debugger UI and scenario runner.

- **[visitor-access](/plugins/reference/visitor-access)** (`@paleoclaw/visitor-access`) - source checkout only. Manage expiring visitor grants through one Cloudflare Access email policy.

## How this page is built

paleoclaw generates this page from the top-level
`extensions/*/openclaw.plugin.json` manifests and the root npm package
`files` exclusions. Optional `package.json` metadata enriches package and
distribution details. Regenerate the page with:

```bash
pnpm plugins:inventory:gen
```
