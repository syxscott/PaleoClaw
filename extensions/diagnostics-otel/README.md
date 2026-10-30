# @paleoclaw/diagnostics-otel

Official OpenTelemetry diagnostics exporter for OpenClaw.

This plugin exports paleoclaw Gateway traces, metrics, and logs to an OTLP collector for observability stacks such as Grafana, Datadog, Honeycomb, New Relic, Tempo, and compatible collectors. It can also write diagnostic log records as stdout JSONL for container log pipelines.

## Install

```bash
paleoclaw plugins install @paleoclaw/diagnostics-otel
```

Restart the Gateway after installing or updating the plugin.

## Configure

Enable the plugin, set `diagnostics.otel.enabled` to `true`, and set the collector URL in `diagnostics.otel.endpoint`.

The full config surface, metric names, span names, and collector examples live in the docs:

- https://docs.openclaw.ai/gateway/opentelemetry

## Package

- Plugin id: `diagnostics-otel`
- Package: `@paleoclaw/diagnostics-otel`
- Minimum paleoclaw host: `2026.4.25`
