---
summary: "Manage expiring visitor grants through one Cloudflare Access email policy."
read_when:
  - You are installing, configuring, or auditing the visitor-access plugin
title: "Visitor Access plugin reference"
---

<!-- Generated file. Do not edit by hand.
Run `pnpm plugins:inventory:gen` to rebuild it. Hand-written text survives only
between the paleoclaw-plugin-reference:manual-start and
paleoclaw-plugin-reference:manual-end comment markers. -->

Manage expiring visitor grants through one Cloudflare Access email policy.

## Distribution

- Package: `@paleoclaw/visitor-access`
- Install route: source checkout only

## Surface

- Contracts: `tools`

<!-- paleoclaw-plugin-reference:manual-start -->

GitHub login lookups use the Gateway's configured GitHub API credential
(`gateway.controlUi.github.token`, or `GH_TOKEN`/`GITHUB_TOKEN`). Rate-limit errors
report the retry/reset time and suggest configuring the credential when absent.

<!-- paleoclaw-plugin-reference:manual-end -->
