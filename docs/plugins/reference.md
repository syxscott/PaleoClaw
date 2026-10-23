---
summary: "Pointer to the generated paleoclaw plugin reference pages"
read_when:
  - You need a reference page for a specific paleoclaw plugin
  - You are auditing plugin docs coverage
title: "Plugin reference"
---

<!-- Generated file. Do not edit by hand.
Run `pnpm plugins:inventory:gen` to rebuild it. -->

This section holds one reference page for each paleoclaw plugin. Each page states
the package, the install route, and the surface the plugin adds.

This page is a pointer, not the index. The browsable list of all
174 generated plugin reference pages lives in
[Plugin inventory](/plugins/plugin-inventory), sorted by distribution, package,
and description.

## How this page is built

paleoclaw generates this page from the top-level
`extensions/*/openclaw.plugin.json` manifests. Package metadata enriches
entries when `package.json` is present. Regenerate the page with:

```bash
pnpm plugins:inventory:gen
```
