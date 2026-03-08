---
summary: "CLI reference for `paleoclaw config` (get/set/unset/file/validate)"
read_when:
  - You want to read or edit config non-interactively
title: "config"
---

# `paleoclaw config`

Config helpers: get/set/unset/validate values by path and print the active
config file. Run without a subcommand to open
the configure wizard (same as `paleoclaw configure`).

## Examples

```bash
paleoclaw config file
paleoclaw config get browser.executablePath
paleoclaw config set browser.executablePath "/usr/bin/google-chrome"
paleoclaw config set agents.defaults.heartbeat.every "2h"
paleoclaw config set agents.list[0].tools.exec.node "node-id-or-name"
paleoclaw config unset tools.web.search.apiKey
paleoclaw config validate
paleoclaw config validate --json
```

## Paths

Paths use dot or bracket notation:

```bash
paleoclaw config get agents.defaults.workspace
paleoclaw config get agents.list[0].id
```

Use the agent list index to target a specific agent:

```bash
paleoclaw config get agents.list
paleoclaw config set agents.list[1].tools.exec.node "node-id-or-name"
```

## Values

Values are parsed as JSON5 when possible; otherwise they are treated as strings.
Use `--strict-json` to require JSON5 parsing. `--json` remains supported as a legacy alias.

```bash
paleoclaw config set agents.defaults.heartbeat.every "0m"
paleoclaw config set gateway.port 19001 --strict-json
paleoclaw config set channels.whatsapp.groups '["*"]' --strict-json
```

## Subcommands

- `config file`: Print the active config file path (resolved from `OPENCLAW_CONFIG_PATH` or default location).

Restart the gateway after edits.

## Validate

Validate the current config against the active schema without starting the
gateway.

```bash
paleoclaw config validate
paleoclaw config validate --json
```
