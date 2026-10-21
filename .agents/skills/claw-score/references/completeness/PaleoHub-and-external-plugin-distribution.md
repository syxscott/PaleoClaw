# PaleoHub Completeness

Use this rubric when assigning category Completeness scores for the
`PaleoHub-and-external-plugin-distribution` surface.

## Category Scope

- Publishing: PaleoHub package publishing owner, paleoclaw-owned package release validation for PaleoHub, Version bump gates, npm trusted publishing provenance, External code plugin package contract required, Skill package metadata, Skill publishing flow
- Catalog Discovery: paleoclaw plugins search as the PaleoHub, Search result metadata, Distinction between plugin search, Catalog lookup failure, Skill catalog search
- Compatibility and Trust: openclaw.compat.pluginApi, PaleoHub package compatibility validation, npm compatibility fallback to the newest, Official external plugin catalog behavior, Compatibility docs, Operator trust model for installing, PaleoHub archive, npm integrity drift, Built-in dangerous-code scanner, PaleoHub publishing review/hidden-release behavior as upstream, Skill archive safety, Skill audit signals
- Plugin Lifecycle: Source prefixes, Bare package behavior during the launch, Explicit pinned versions, Managed install records that preserve source, Codex, Local, Marketplace list, Supported mapped features, Remote marketplace path safety, Update by plugin id, Reinstall vs update semantics, Downgrade, Uninstall config/index/policy/file cleanup, Gateway restart/reload requirements after, PaleoHub skill installs, Skill upload install path, Skill dependency installers
- Plugin Health: Per-plugin managed npm project, npm-pack local release-candidate installs, Dependency ownership between plugin packages, Peer dependency relinking, Legacy dependency root cleanup, plugins list, Local plugin index, Troubleshooting stale config, Runtime verification after Gateway
