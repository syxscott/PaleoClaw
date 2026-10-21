---
summary: "Use Poolside Laguna models or the Poolside Agent with paleoclaw"
read_when:
  - You want to use Poolside Laguna models with paleoclaw
  - You want to run the Poolside Agent through ACP
title: "Poolside (Laguna)"
---

[Poolside](https://poolside.ai) provides Laguna models and the Poolside Agent CLI.
Choose the integration for the work you want paleoclaw to do:

| Goal                                                 | Integration                         |
| ---------------------------------------------------- | ----------------------------------- |
| Use Laguna models with the paleoclaw agent            | Poolside-maintained provider plugin |
| Run the Poolside Agent as an external coding harness | ACP with the `pool` target          |

## Laguna model provider

Install the external
[`@poolside/paleoclaw-provider` plugin](https://hub.openclaw.ai/poolside/plugins/paleoclaw-provider):

```bash
paleoclaw plugins install @poolside/paleoclaw-provider
```

Follow [Poolside's paleoclaw guide](https://docs.poolside.ai/tools/paleoclaw) for
authentication, model selection, and hosted or self-managed endpoints. The plugin
owns Poolside's model catalog and request compatibility.

If you use `POOLSIDE_API_KEY`, make it available to the **Gateway process** before
restarting the Gateway. For a managed service, put it in the global runtime
`.env` file or the service environment. Exporting it later in an interactive
shell does not update the running service. See [Environment variables](/help/environment).

## Poolside Agent over ACP

The `pool` ACP target launches `pool acp`. Install and authenticate the
[Poolside CLI](https://docs.poolside.ai/cli/install) on the Gateway host, and make
sure `pool` is on the Gateway's `PATH`. Configure CLI authentication separately
from the paleoclaw provider plugin.

Enable the ACP runtime plugin as described in
[ACP quickstart](/tools/acp-agents/quickstart). If `acp.allowedAgents` is set, include
`pool`. Then start a session:

```text
/acp spawn pool
```

See [ACP setup](/tools/acp-agents-setup) for permissions and
[Poolside's paleoclaw guide](https://docs.poolside.ai/tools/paleoclaw) for CLI setup.
