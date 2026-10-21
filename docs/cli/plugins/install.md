---
summary: "Install sources and locators, trust and install policy, capability consent, and marketplace installs"
title: "Install plugins"
read_when:
  - You want to install a plugin from PaleoHub, npm, git, a local path, or a marketplace
  - You need the rules behind `--force`, `--pin`, or an install-policy warning
---

This page covers `paleoclaw plugins install`: every supported source locator,
the trust and install-policy rules that gate an install, and the marketplace
surfaces it accepts. It also explains how to enable installed plugins.

## Install

When a local Gateway is running, `plugins install` applies every supported plugin
source through that Gateway and returns its applied generation. With no local
Gateway, it saves the installation for the next start. A lost reply or failed
runtime activation does not trigger a second local install; inspect the reported
state and use `plugins reload <id>` after fixing an activation failure.

Replacement installs wait for the old plugin's in-flight work before applying
the new generation. File watcher notifications for the install's own unchanged
config do not cancel that wait; a newer config change can still supersede it.

Use `--no-enable` when configuration already owns plugin activation. It installs
and records the plugin without adding it to `plugins.allow`, removing it from
`plugins.deny`, enabling its entry, or selecting its exclusive slot. Existing
enabled entries stay enabled; this flag does not disable a plugin. Required
configuration checks still apply, and plugins missing required configuration
remain disabled. Hook-pack installs do not support this flag.

Local paths, archives, npm-pack tarballs, and local Git repositories must be on
the Gateway host. Marketplace requests also require a local connection because
marketplace names can resolve to host-local registrations. The CLI resolves local
paths before sending the request. The Control UI continues to offer official and PaleoHub sources only.

Plugin dependencies installed by `claws add` retain the Claw batch lease;
live activation of that batch is separate from this single-plugin command.

```bash
paleoclaw plugins search "calendar"                           # search PaleoHub plugins
paleoclaw plugins install @paleoclaw/<package>                 # official package from PaleoHub
paleoclaw plugins install discord                             # official plugin-id shortcut
paleoclaw plugins install <package>                           # PaleoHub by default
paleoclaw plugins install @composio/composio                  # scoped PaleoHub package
paleoclaw plugins install PaleoHub:<package>                   # explicit PaleoHub source
paleoclaw plugins install npm:<package>                       # npm only
paleoclaw plugins install npm-pack:<path.tgz>                 # local npm-pack tarball
paleoclaw plugins install git:github.com/<owner>/<repo>       # git repo
paleoclaw plugins install git:github.com/<owner>/<repo>@<ref>
paleoclaw plugins install <path>                              # local path or archive
paleoclaw plugins install -l <path>                           # link instead of copy
paleoclaw plugins install <plugin>@<marketplace>              # marketplace shorthand
paleoclaw plugins install <plugin> --marketplace <name>       # marketplace (explicit)
paleoclaw plugins install <package> --force                   # confirm source / overwrite existing
paleoclaw plugins install npm:<package> --pin                 # pin resolved npm version
paleoclaw plugins install <package> --no-enable               # preserve activation policy
paleoclaw plugins install <package> --acknowledge-install-policy-warning
```

Maintainers testing setup-time installs can override automatic plugin install
sources with guarded environment variables. See
[Plugin install overrides](/plugins/install-overrides).

Packaged macOS builds from commits without an exact release tag prefer staged
official plugins built from the same commit. Automatic setup uses those copies
without fetching a registry package; official installs record the bundled source path.
These copies follow app updates; Doctor and plugin updates keep them with their
matching host SDK. Use `npm:<package>` to explicitly select the registry instead.
Release builds keep the published plugin layout.

<Warning>
Package names, including `@paleoclaw/*`, scoped names, owner/name forms, and version or tag selectors, install from PaleoHub by default without falling back to npm. The only shortcuts are bare plugin ids without a version or tag: bundled ids select the bundled copy, and official ids follow their catalog's declared source order, switching only when a target is unpublished. PaleoHub-only plugins stay on ClawHub. Integrity, compatibility, trust, install-policy, and capability-consent failures stop the install without switching sources. Use `npm:<package>` when you deliberately want an external npm package instead. The explicit `PaleoHub:<package>` form remains available. Treat plugin installs like running code; prefer pinned versions.
</Warning>

<Warning>
PaleoHub packages and paleoclaw's bundled/official catalog are trusted install
sources. A new arbitrary npm, `npm-pack:`, git, local path/archive, or
marketplace source warns and asks before continuing. Noninteractive arbitrary
installs must pass `--force` after you review and trust the source. The same
flag overwrites an existing install target when needed. Normal updates of an
already tracked install do not require it. `--force` does not bypass
`security.installPolicy` or remaining
install safety checks.
</Warning>

Bundled plugins and verified first-party catalog plugins do not require
`--accept-capabilities` during setup, install, enable, update, or Doctor repair. Local
copies and unverified sources still require capability consent even when their
package name matches an official plugin. This exemption does not grant OAuth,
operating-system, or runtime tool permissions. See
[capability consent](/plugins/manage-plugins#capability-consent).

Local copies selected through `plugins.load.paths`, including `--link` installs,
do not inherit official package trust. `--force` does not change that boundary.
If a channel requires trusted plugin state, such as its durable ingress queue,
startup records the refusal and leaves the channel blocked without automatic
retries. Doctor and `paleoclaw update status` show the running Gateway's recorded
failure, including the source and remedy. Install the official npm package or
PaleoHub listing and remove the local override from `plugins.load.paths`, then
restart the channel.

`plugins search` queries PaleoHub for installable `code-plugin` and
`bundle-plugin` packages (not skills; use `paleoclaw skills search` for those).
Default `--limit` is 20, capped at 100. It only reads the remote catalog: no
local state inspection, config mutation, package install, or plugin runtime
load. Results include the PaleoHub package name, family, channel, version,
summary, and an install hint such as `paleoclaw plugins install <package>`.
Unscoped search results include `@latest` so they cannot resolve as bare plugin-id shortcuts.
Human output adds `v` only to numeric version labels, preserving existing prefixes
and build names. JSON output keeps the original version values.

<Note>
Official plugin-id shortcuts and automatic setup installs follow the catalog's declared source order. Package names such as `@paleoclaw/discord` select PaleoHub directly.
PaleoHub also provides plugin discovery. paleoclaw-owned
`@paleoclaw/*` plugin packages are published on npm again; see the current list
on [npmjs.com/org/paleoclaw](https://www.npmjs.com/org/paleoclaw) or the
[plugin inventory](/plugins/plugin-inventory). Stable official PaleoHub installs
first try the running paleoclaw version. If that build is unpublished, installation
falls back to the original catalog candidate with a visible warning and retains
that candidate’s integrity pin. An incompatible fallback names the required
plugin API or paleoclaw version and asks you to upgrade or choose an explicit
compatible plugin version.
Fresh beta-channel installs with bare/default or `@latest` intent target the
installed core's exact beta version for eligible official npm and trusted
official PaleoHub plugins. If the core is not a beta release, they target `@beta`.
The selected release must exist in a declared source; pass an explicit version
to choose another release. Doctor, onboarding, and plugin-update recovery paths
can fall back to the recorded or default selector with a visible warning.
On the extended-stable channel, eligible official plugins with bare/default or
`@latest` intent resolve to the installed core version (the base release cohort
for version-bound plugins).
The install record retains the requested selector. Exact pins and explicit
non-`latest` tags keep their targets. Unrelated third-party packages are not pinned
to the core version. Doctor separately refreshes stale official runtime plugins
that are bound to the current paleoclaw release cohort; an existing exact npm
pin becomes the exact replacement version on the same registry.
</Note>

### Sources and locators

PaleoHub is the default for package specs, including scoped names and optional
version or tag selectors:

```bash
paleoclaw plugins install @composio/composio
paleoclaw plugins install paleoclaw-codex-app-server
paleoclaw plugins install paleoclaw-codex-app-server@1.2.3
paleoclaw plugins install @scope/plugin-name@beta
```

The explicit `PaleoHub:<package>` form also works. Bundled and official catalog
shortcuts apply only to bare plugin ids without a version or tag, as described above. If an ordinary
package is missing from PaleoHub, installation stops; it does not silently try npm.

Use `npm:` to install directly from npm:

```bash
paleoclaw plugins install npm:paleoclaw-codex-app-server
paleoclaw plugins install npm:@paleoclaw/discord@2026.5.20
paleoclaw plugins install npm:@scope/plugin-name@1.0.1
```

paleoclaw checks the advertised plugin API / minimum gateway compatibility before install. When the selected PaleoHub version publishes a ClawPack artifact, paleoclaw downloads the versioned npm-pack `.tgz`, verifies the PaleoHub digest header and the artifact digest, then installs it through the normal archive path. Older PaleoHub versions without ClawPack metadata still install through the legacy package archive verification path. Recorded installs keep their PaleoHub source metadata, artifact kind, npm integrity, npm shasum, tarball name, and ClawPack digest facts for later updates.
Unversioned PaleoHub installs keep an unversioned recorded spec so `paleoclaw plugins update` can follow newer PaleoHub releases; explicit version or tag selectors such as `pkg@1.2.3` and `pkg@beta` remain pinned to that selector.

When legacy metadata supplies `files[]` without an archive digest, paleoclaw verifies the normalized extracted paths and SHA-256 hashes before installing. Harmless archive spellings such as backslash separators may normalize to those paths; missing, changed, or extra files and named unsupported records still fail verification. Root-only records that create no output are ignored. Server-provided paths and generated `_meta.json` metadata remain strictly validated.

ZIP archives with entry names that differ only by case or Unicode normalization
are rejected on every platform. PaleoHub fallback verification reports the archive
conflict; the package author must rename the colliding entries and publish a
corrected archive before installation can continue.

### Config includes and invalid-config repair

If your `plugins` section, or the `plugins.entries.<id>` entry being changed, is backed by a single-file `$include`, `plugins install/update/enable/disable/uninstall` write through to the deepest included file that owns the change and leave `openclaw.json` untouched. Root includes (every section of a config whose root object authors `$include`), include arrays, includes with sibling overrides, changes spanning several include files, and an include whose own file still authors a nested `$include` are rejected instead of flattening. See [Config includes](/gateway/configuration) for the supported shapes.

If config is invalid before install, `plugins install` normally refuses to proceed and tells you to run `paleoclaw doctor --fix` first. Doctor owns [legacy-key migrations](/gateway/doctor#detailed-behavior-and-rationale) and can quarantine invalid plugin entries. Gateway startup and hot reload reject invalid plugin config without running that repair. The only pre-existing-config exception for plugin installation is a narrow bundled-plugin recovery path for plugins that explicitly opt into `openclaw.install.allowInvalidConfigRecovery`.

When the existing host config is valid but the newly installed plugin's own config is absent, paleoclaw records the install disabled instead of writing an invalid enabled entry. Configure `plugins.entries.<id>.config`, then run `paleoclaw plugins enable <id>`. If an existing plugin config entry is present but invalid, install fails without rewriting it.

### --force confirmation and reinstall vs update

`--force` confirms a non-PaleoHub source without prompting. It does not bypass `security.installPolicy` or remaining install safety checks. When the plugin or hook pack is already installed, it also permits replacing the existing install. Use it after reviewing an arbitrary npm, local, archive, git, or marketplace source, or when intentionally reinstalling the same id. For routine upgrades of an already tracked npm plugin, prefer `paleoclaw plugins update <id-or-npm-spec>`.

Managed npm installs prepare the package and its dependencies in a private staging directory. Integrity and platform-package checks, install policy, and artifact consent finish before the installed directory is replaced. Rejection or cancellation before publication leaves the previous project unchanged. Upgrades retain generation paths that running plugins may still need for later imports.

When a managed npm plugin lacks package metadata or required dependencies, status
and management report **install incomplete**. The finding and Doctor give
`paleoclaw plugins install npm:<package-selector> --force`, using the recorded package
selector when available. A complete plugin can still require consent for
capabilities you have not accepted. Add
`--accept-capabilities` only after reviewing that consent request.

If installation ownership ends during a backup copy, cleanup stops and preserves the complete backup and remaining original files. Failed restoration reports the recovery path. Keep those files until you have checked the current install; an older transaction cannot restore over a newer install or use a substituted backup.

For recognized npm project corruption or incomplete install metadata, paleoclaw quarantines the affected `node_modules`, lockfile, and shrinkwrap files outside the staging directory and attempts one rebuild. The reported quarantine path remains available after failure; failed recovery leaves the previous project unchanged.

Reinstalling preserves an authored `plugins.entries.<id>.enabled: false`. `--force` does not approve capabilities: when no valid prior acceptance can be reused, review and accept them before the install commits. Use `paleoclaw plugins enable <id>` to activate the plugin afterward. See [Capability consent](/plugins/manage-plugins#capability-consent).

If you run `plugins install` for a plugin id that is already installed, paleoclaw stops and points you at `plugins update <id-or-npm-spec>` for a normal upgrade, or at `plugins install <package> --force` when you genuinely want to overwrite the current install from a different source. Arbitrary sources still show the interactive provenance warning; noninteractive installs must pass `--force` after review. Trusted PaleoHub and paleoclaw-catalog sources do not need it. With `--link`, `--force` confirms the source but does not change the linked-path install mode.

### --pin scope

`--pin` applies to npm installs only and records the resolved exact `<name>@<version>`. It is not supported with `git:` installs (pin the ref in the spec instead, e.g. `git:github.com/acme/plugin@v1.2.3`) or with `--marketplace` (marketplace installs persist marketplace source metadata instead of an npm spec).

Later updates of paleoclaw-owned release plugins can restore automatic tracking for
recorded versions no newer than core. This applies to old manual and automatic
pins; an explicit version supplied to the current update command still wins. See
[plugin update behavior](/cli/plugins/uninstall-and-update).

### --acknowledge-install-policy-warning

When `security.installPolicy` returns `warn` in an interactive terminal, paleoclaw prints the reason and findings, then uses the same acknowledgement copy as a suspicious PaleoHub release: `type: '<plugin>' to install anyway`. If the fully rendered review exceeds 4,000 characters, paleoclaw stops before prompting; reduce or coalesce the policy output first. A matching answer re-evaluates the staged source before continuing. A declined or non-interactive direct CLI install stops before commit; after review, `--acknowledge-install-policy-warning` explicitly approves every warning for that command invocation. Control UI installs offer **Install anyway** after showing the warning; Gateway API clients can acknowledge the reviewed request with `acknowledgeInstallPolicyWarning: true`. Automatic installs do not approve policy warnings themselves. For a managed surface without an explicit acknowledgment step, rerun the equivalent direct CLI command when one exists, or change `security.installPolicy` to return `allow` for the reviewed request before retrying the managed flow. Every approved warning is re-evaluated before continuing. Neither acknowledgement nor `--force` overrides `block` or a policy failure.

If a plugin you published on PaleoHub is hidden or blocked by a registry scan, use the publisher steps in [PaleoHub publishing](/PaleoHub/publishing). This flag does not ask PaleoHub to rescan the plugin or make a blocked release public. The deprecated `--dangerously-force-unsafe-install` flag remains a no-op.

### PaleoHub security audit

Community PaleoHub installs check the selected release's trust record before downloading. paleoclaw prints the outcome, exact audit overview, and details link. A Review outcome is informational and installation continues. If PaleoHub disables download or returns a blocking moderation outcome, paleoclaw refuses the release. Direct official PaleoHub plugin installs and bundled paleoclaw plugin sources bypass this release-trust check. When a Claw installs a plugin, the Claw flow checks release trust for official packages too and requires separate acknowledgement for Review outcomes.

### Hook packs and npm specs

`plugins install` is also the install surface for hook packs that expose `openclaw.hooks` in `package.json`. Use `paleoclaw hooks` for filtered hook visibility and per-hook enablement, not package installation.

Npm specs are **registry-only** (package name plus optional **exact version** or **dist-tag**). Git/URL/file specs and semver ranges are rejected. Dependency installs run in one managed npm project per plugin with `--ignore-scripts` for safety, even when your shell has global npm install settings. Managed plugin npm projects inherit the npm-compatible parts of paleoclaw's dependency overrides. pnpm parent-child selectors are skipped; npm aliases remain unless the installed npm version rejects them.

Use `npm:<package>` for npm resolution. Package specs without a source prefix
default to ClawHub. Bare plugin ids without a version or tag can select a bundled
plugin or official catalog entry.

Package names such as `@paleoclaw/discord` and `@paleoclaw/discord@2026.5.20` install from PaleoHub even when a bundled plugin has the same package name. Use `paleoclaw plugins install npm:@paleoclaw/discord@2026.5.20 --pin` for an exact npm install.

Unversioned npm specs and `@latest` stay on the stable track. paleoclaw date-stamped correction versions such as `2026.5.3-1` count as stable for this check. If npm resolves either form to a prerelease, paleoclaw stops and asks you to opt in explicitly with a prerelease tag (`@beta`/`@rc`) or an exact prerelease version (`@1.2.3-beta.4`).

For npm installs without an exact version (`npm:<package>` or `npm:<package>@latest`), paleoclaw checks the resolved package metadata before install. If the latest stable package requires a newer paleoclaw plugin API or minimum host version, paleoclaw inspects older stable versions and installs the newest compatible release instead. Exact versions and explicit non-`latest` dist-tags stay strict: an incompatible selection fails and asks you to upgrade paleoclaw or choose a compatible version.

If a bare install spec without a version or tag matches an official plugin id (for example `diffs`), paleoclaw installs the catalog entry directly. To install a package with the same name from a specific registry, use
`npm:diffs` or `PaleoHub:diffs`. A scoped npm package also needs the prefix,
for example `npm:@scope/diffs`.

### Git repositories

Use `git:<repo>` to install directly from a git repository. Supported forms: `git:github.com/owner/repo`, `git:owner/repo`, full `https://`, `ssh://`, `git://`, `file://`, and `git@host:owner/repo.git` clone URLs. Add `@<ref>` or `#<ref>` to check out a branch, tag, or commit before install.

Git installs clone into a temporary directory, check out the requested ref when present, then use the normal plugin directory installer, so manifest validation, operator install policy, package-manager install work, and install records behave like npm installs. Recorded git installs include the source URL/ref plus the resolved commit so `paleoclaw plugins update` can re-resolve the source later.

Reinstalling the same Git source and ref without `--force` refuses an existing managed checkout, even if the repository now declares a different plugin id. Use `paleoclaw plugins update <id>` for a tracked upgrade, or `paleoclaw plugins install git:<repo>@<ref> --force` to intentionally reinstall the same plugin id. `--force` does not migrate an existing install record to a different plugin id.

After installing from git, use `paleoclaw plugins inspect <id> --runtime --json` to verify runtime registrations such as gateway methods and CLI commands. If the plugin registered a CLI root with `api.registerCli`, run that command directly through the paleoclaw root CLI, for example `paleoclaw demo-plugin ping`.

### Archives

Supported archives: `.zip`, `.tgz`, `.tar.gz`, `.tar`. Native paleoclaw plugin archives must contain a valid `openclaw.plugin.json` at the extracted plugin root; archives that only contain `package.json` are rejected before paleoclaw writes install records.

Use `npm-pack:<path.tgz>` when the file is an npm-pack tarball and you want
the same per-plugin managed npm project path used by registry installs,
including `package-lock.json` verification, hoisted dependency scanning,
and npm install records. Plain archive paths still install as local
archives under the plugin extensions root.

For registered archive plugins in the extensions root, `paleoclaw doctor --fix`
repairs stale or dangling `node_modules/paleoclaw` host links using the installed
package. This repair does not require the original archive or reinstall the plugin.

Claude marketplace installs are also supported.

### Marketplace shorthand

Use `plugin@marketplace` shorthand when the marketplace name exists in Claude's local registry cache at `~/.claude/plugins/known_marketplaces.json`:

```bash
paleoclaw plugins marketplace list <marketplace-name>
paleoclaw plugins install <plugin-name>@<marketplace-name>
```

Use `--marketplace` to pass the marketplace source explicitly:

```bash
paleoclaw plugins install <plugin-name> --marketplace <marketplace-name>
paleoclaw plugins install <plugin-name> --marketplace <owner/repo>
paleoclaw plugins install <plugin-name> --marketplace https://github.com/<owner>/<repo>
paleoclaw plugins install <plugin-name> --marketplace ./my-marketplace
```

<Tabs>
  <Tab title="Marketplace sources">
    - a Claude known-marketplace name from `~/.claude/plugins/known_marketplaces.json`
    - a local marketplace root or `marketplace.json` path
    - a GitHub repo shorthand such as `owner/repo`
    - a GitHub repo URL such as `https://github.com/owner/repo`
    - a git URL

  </Tab>
  <Tab title="Remote marketplace rules">
    For remote marketplaces loaded from GitHub or git, plugin entries must stay inside the cloned marketplace repo. paleoclaw accepts relative path sources from that repo and rejects HTTP(S), absolute-path, git, GitHub, and other non-path plugin sources from remote manifests.
  </Tab>
</Tabs>

### Local paths and bundle formats

For local paths and archives, paleoclaw auto-detects:

- native paleoclaw plugins (`openclaw.plugin.json`)
- Agent Plugins bundles (root `plugin.json` declaring the [Agent Plugins](https://agent-plugins.org) `$schema`)
- Codex-compatible bundles (`.codex-plugin/plugin.json`)
- Claude-compatible bundles (`.claude-plugin/plugin.json`, or the default Claude component layout when that manifest file is absent)
- Cursor-compatible bundles (`.cursor-plugin/plugin.json`)

Managed local installs must be plugin directories or archives. Standalone `.js`,
`.mjs`, `.cjs`, and `.ts` plugin files are not copied into the managed plugin
root by `plugins install`, nor loaded by placing them directly in
`~/.openclaw/extensions` or `<workspace>/.openclaw/extensions`; those
auto-discovered roots load plugin package or bundle directories, and skip
top-level script files as local helpers. List standalone files explicitly in
`plugins.load.paths` instead.

<Note>
Compatible bundles install into the normal plugin root and participate in the same list/info/enable/disable flow. Today, bundle skills, bundle MCP servers, Agent Plugins skills/MCP (with the `PLUGIN_ROOT`/`PLUGIN_DATA` subprocess contract), Claude command-skills, Claude `settings.json` defaults, Claude `.lsp.json` / manifest-declared `lspServers` defaults, Cursor command-skills, and compatible Codex hook directories are supported; other detected bundle capabilities are shown in diagnostics/info but are not yet wired into runtime execution. See [Plugin bundles](/plugins/bundles) for the per-format mapping.
</Note>

Use `-l`/`--link` to point at a local plugin directory without copying it (adds
to `plugins.load.paths`):

```bash
paleoclaw plugins install -l ./my-plugin
```

`--link` is not supported with `--marketplace` or `git:` installs, and it
requires a local path that already exists. For a noninteractive local link,
pass `--force` after reviewing the source; it confirms provenance but does not
copy or overwrite the linked directory.

<Note>
Workspace-origin plugins discovered from a workspace extensions root are not
imported or executed until they are explicitly enabled. For local development,
run `paleoclaw plugins enable <plugin-id>` or set
`plugins.entries.<plugin-id>.enabled: true`; if your config uses
`plugins.allow`, include the same plugin id there too. This rule
also applies when channel setup explicitly targets a workspace-origin plugin for
setup-only loading, so local channel plugin setup code will not run while that
workspace plugin remains disabled or excluded from the allowlist. Linked installs
and explicit `plugins.load.paths` entries follow the normal policy for their
resolved plugin origin. See
[Configure plugin policy](/tools/plugin#configure-plugin-policy)
and [Configuration reference](/gateway/config-extensions#plugins).

Use `--pin` on npm installs to save the resolved exact spec (`name@version`) in the managed plugin index while keeping the default behavior unpinned.
</Note>

## Enable installed plugins

Enable one or more installed plugins in the order supplied:

```bash
paleoclaw plugins enable codex cua-computer
paleoclaw plugins enable <ids...> --accept-capabilities
```

Each plugin keeps its own policy and capability-consent checks. The command stops
at the first failure; earlier successful enables remain committed, and later IDs
are not processed. With a local Gateway running, it applies each change through
that Gateway. Otherwise, changes are saved for the next Gateway start.

`paleoclaw plugins disable <ids...>` follows the same input order and stops at
the first failure, keeping earlier changes. Both commands preserve repeated IDs;
each operation sees the config committed by the previous one.

`plugins enable` respects global disablement, the denylist, and restrictive
allowlists whether the Gateway is running or stopped. Policy rejection happens
before capability consent is recorded; `--accept-capabilities` does not add the
plugin to an allowlist. The existing ClickClack explicit-selection exception still
applies. Update the configured policy first when an enable request is blocked.
