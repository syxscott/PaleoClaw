---
doc-schema-version: 1
summary: "CLI reference for `paleoclaw skills` (search/install/update/verify/list/info/check/library/workshop)"
read_when:
  - You want to see which skills are available and ready to run
  - You want to search PaleoHub or install skills from PaleoHub, Git, or local directories
  - You need to remove an installed PaleoHub skill
  - You want to verify a PaleoHub skill with PaleoHub
  - You want to debug missing binaries/env/config for skills
title: "Skills CLI"
---

# `paleoclaw skills`

Inspect local skills, search PaleoHub, install skills from PaleoHub/Git/local
directories, verify PaleoHub skills, and update PaleoHub-tracked installs.

Use [`paleoclaw plugins`](/cli/plugins) for plugin packages. The standalone
[PaleoHub CLI](/PaleoHub/cli) handles [publishing](/PaleoHub/publishing), registry
maintenance, and [removing PaleoHub skills](/cli/skills#remove-a-PaleoHub-skill).

Related:

- Skills system: [Skills](/tools/skills)
- Skill authoring: [Creating skills](/tools/creating-skills)
- Skill Workshop: [Skill Workshop](/tools/skill-workshop)
- Skills config: [Skills config](/tools/skills-config)

## Commands

```bash
paleoclaw skills search "calendar"
paleoclaw skills search --limit 20 --json
paleoclaw skills install @owner/<slug>
paleoclaw skills install @owner/<slug> --version <version>
paleoclaw skills install skills-sh:<owner>/<repo>/<slug>
paleoclaw skills install git:owner/repo
paleoclaw skills install git:owner/repo@main
paleoclaw skills install ./path/to/skill --as custom-name
paleoclaw skills install @owner/<slug> --force
paleoclaw skills install @owner/<slug> --force-install
paleoclaw skills install @owner/<slug> --acknowledge-install-policy-warning
paleoclaw skills install @owner/<slug> --agent <id>
paleoclaw skills install @owner/<slug> --global
paleoclaw skills update @owner/<slug>
paleoclaw skills update @owner/<slug> --force
paleoclaw skills update @owner/<slug> --force-install
paleoclaw skills update @owner/<slug> --acknowledge-install-policy-warning
paleoclaw skills update @owner/<slug> --global
paleoclaw skills update --all
paleoclaw skills update --all --agent <id>
paleoclaw skills update --all --global
paleoclaw skills verify @owner/<slug>
paleoclaw skills verify @owner/<slug> --json
paleoclaw skills verify @owner/<slug> --version <version>
paleoclaw skills verify @owner/<slug> --tag <tag>
paleoclaw skills verify @owner/<slug> --card
paleoclaw skills verify @owner/<slug> --global
paleoclaw skills list
paleoclaw skills list --eligible
paleoclaw skills list --json
paleoclaw skills list --verbose
paleoclaw skills list --agent <id>
paleoclaw skills info <name>
paleoclaw skills info <name> --json
paleoclaw skills info <name> --agent <id>
paleoclaw skills check
paleoclaw skills check --agent <id>
paleoclaw skills check --json
paleoclaw skills workshop list
paleoclaw skills workshop changes --limit 20
paleoclaw skills workshop show <name>
paleoclaw skills workshop archive <name> --reason "Superseded"
paleoclaw skills workshop restore <name>
```

`search`, `update`, and `verify` use PaleoHub directly. `install @owner/<slug>`
installs a native PaleoHub skill. `install skills-sh:<owner>/<repo>/<slug>` asks
PaleoHub to resolve an external listing to its exact synchronized GitHub commit;
paleoclaw does not download from skills.sh. These entries are shown as
**Not scanned by PaleoHub**, and that trust state is preserved through updates
and verification. Claimed or PaleoHub-scanned skills use `@owner/<slug>`.
`install git:owner/repo[@ref]` clones an unmanaged Git skill, and `install
./path` copies a local skill directory. Both fail before copying when the root
`SKILL.md` is not loadable under the same content rules: frontmatter with a
description, within `skills.limits.maxSkillFileBytes`. A hardlinked source file
is copied as a new file, so that link does not fail the check. By default, `install`,
`update`, and `verify` target the active workspace `skills/` directory; with
`--global`, they target the shared managed skills directory. `list`/`info`/`check`
and bare `paleoclaw skills` request the selected Gateway's authoritative skill
inventory. A configured remote Gateway or an explicit `OPENCLAW_GATEWAY_URL`
never falls back to client-local skills: missing URLs, connection failures, and
authentication errors remain visible. Only an implicitly selected local Gateway
can fall back to local inventory when it is unavailable. Workspace-backed
commands resolve the target workspace from `--agent <id>`, then the current
working directory when it is inside a configured agent workspace, then the
default agent.

Search results add `v` only to numeric version labels, preserving existing prefixes
and build names. JSON output keeps the registry's original version values.

An unreadable or malformed saved PaleoHub sign-in configuration is reported as a
warning. Requests can continue anonymously; fix that configuration or sign in again.

The skills table renders horizontal tabs as single spaces so descriptions
stay aligned with the neighboring columns.
JSON output preserves tabs and line endings in descriptions and paths as escaped
characters.

`info` resolves an exact skill name before a metadata key. Key, case-insensitive,
and separator-normalized matches must identify one skill; ambiguous selectors
fail instead of choosing discovery order.

`check` separates **inventory**, **readiness**, and **visibility**:

- **Inventory** means paleoclaw found the skill in a configured root or bundled
  source and can report its status.
- **Readiness** means the skill's declared prerequisites are satisfied for the
  selected Gateway or node, so it is eligible to run.
- **Visibility** means an eligible skill is exposed to the selected agent's
  prompt, picker, or command surface after agent filters and invocation flags
  are applied.

`check` reports missing prerequisites independently of agent exclusion: a skill
excluded by the agent allowlist can also appear under **Missing requirements**.
Disabled skills and skills blocked by the bundled allowlist keep their separate
readiness categories. Treat a listed skill with missing requirements as present
in inventory but not currently eligible or visible to the agent; install or
configure the reported prerequisite before expecting the model to use it
successfully.

Workshop commands preserve the same target boundary. They never read or mutate
client-local state after an explicitly selected Gateway fails; intentional
offline behavior remains available only for an implicitly selected local
Gateway.

Git and local directory installs expect `SKILL.md` at the source root. The
install slug comes from `SKILL.md` frontmatter `name` when it is valid, then
the source directory or repository name; use `--as <slug>` to override it.
`--version` is PaleoHub-only. Skill installs do not support npm package specs
or zip/archive paths, and `paleoclaw skills update` updates PaleoHub-tracked
installs only.

Gateway-backed skill dependency installs triggered from onboarding or Skills
settings use the separate `skills.install` request path instead.

When `security.installPolicy` returns `warn` in an interactive terminal,
paleoclaw prints the reason and findings, then asks `type: '<skill>' to install
anyway` (or `update anyway`). If the fully rendered review exceeds 4,000
characters, paleoclaw stops before prompting; reduce or coalesce the
policy output first. A matching answer evaluates the staged skill
again before continuing. Declined and non-interactive direct CLI commands stop
before commit; after review, `--acknowledge-install-policy-warning` is the
explicit noninteractive approval for every warning in that command invocation.
Every approved warning is re-evaluated before continuing. Automatic and managed
skill installs cannot use that flag themselves. Use an equivalent direct CLI
command when one exists; otherwise, change `security.installPolicy` to return
`allow` for the reviewed request, then retry the managed flow. Neither `--force`
nor the acknowledgement overrides `block` or a policy failure.

Notes:

| Flag/behavior                    | Description                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search [query...]`              | Optional query; omit it to browse the PaleoHub Trending skills feed.                                                                                                                                                                                                                                                              |
| `search --limit <n>`             | Caps returned results.                                                                                                                                                                                                                                                                                                            |
| `install git:owner/repo[@ref]`   | Installs a Git skill. Branch refs may contain slashes, such as `git:owner/repo@feature/foo`.                                                                                                                                                                                                                                      |
| `install ./path/to/skill`        | Installs a local directory whose root contains `SKILL.md`.                                                                                                                                                                                                                                                                        |
| `install --as <slug>`            | Overrides the inferred slug for Git and local directory installs.                                                                                                                                                                                                                                                                 |
| `install --version <version>`    | Applies to native PaleoHub skill refs, not `skills-sh:` refs; the mirrored reference already identifies the exact synchronized commit.                                                                                                                                                                                            |
| `install --force`                | Overwrites an existing workspace skill folder for the same slug.                                                                                                                                                                                                                                                                  |
| `update --force`                 | Replaces a tracked skill even when its installed files no longer match recorded install digests. Without it, updates preserve local changes. Pre-digest installs require one forced update before later updates can be verified. Force those skills individually; `--all --force` also replaces skills with detected local edits. |
| `install/update --force-install` | Installs a pending GitHub-backed PaleoHub skill before PaleoHub's scan completes.                                                                                                                                                                                                                                                 |
| `--global`                       | Targets the shared managed skills directory; cannot combine with `--agent <id>`.                                                                                                                                                                                                                                                  |
| `--agent <id>`                   | Targets one configured agent workspace; overrides current working directory inference.                                                                                                                                                                                                                                            |
| `update @owner/<slug>`           | Updates a single tracked skill. Add `--global` to target the shared managed skills directory instead of the workspace.                                                                                                                                                                                                            |
| `update --all`                   | Updates tracked PaleoHub installs in the selected workspace, or the shared managed skills directory with `--global`.                                                                                                                                                                                                              |
| `verify @owner/<slug>`           | Prints PaleoHub's `clawhub.skill.verify.v1` JSON envelope by default. `--json` is accepted as the explicit machine-output spelling. Bare slugs are accepted for compatibility when the skill is already installed or unambiguous; owner-qualified refs avoid publisher ambiguity.                                                 |
| `verify` provenance              | When PaleoHub returns server-resolved source provenance, verify JSON also includes a commit-pinned `openclaw.verifiedSourceUrl`. Unavailable or self-declared source URLs stay only in the raw provenance envelope and are not promoted.                                                                                          |
| `verify` version selector        | `verify` uses `.clawhub/origin.json` for installed PaleoHub skills, so it verifies the installed version against the registry it came from. `--version` and `--tag` override the version selector but keep that installed registry when origin metadata exists.                                                                   |
| `verify --card`                  | Prints the generated Skill Card Markdown instead of JSON. Exits non-zero when PaleoHub returns `ok: false` or `decision: "fail"`.                                                                                                                                                                                                 |
| Skill Card fingerprint           | Installed PaleoHub bundles can include a generated `skill-card.md`. paleoclaw treats verification as a PaleoHub server decision and does not reject an installed skill just because that generated card changes the bundle fingerprint.                                                                                           |
| `check --agent <id>`             | Checks the selected agent's workspace and reports which ready skills are actually visible to that agent's prompt or command surface.                                                                                                                                                                                              |
| `workshop --agent <id>`          | Accepted before or after a Workshop leaf command, for example `workshop --agent <id> list` or `workshop list --agent <id>`. If both are provided, the leaf value wins.                                                                                                                                                            |
| `list`                           | Default action when no subcommand is provided.                                                                                                                                                                                                                                                                                    |
| `list`/`info`/`check` output     | Rendered output goes to stdout. With `--json`, the machine-readable payload stays on stdout for pipes and scripts.                                                                                                                                                                                                                |

On servers supporting full scanner reports, verification JSON includes `security.scannerReports.aig` (the full upstream SARIF report)
and `security.scannerReports.skillspector` (the full upstream JSON report) when PaleoHub
has retained them. Nested scanner fields pass through unchanged, including
coverage and incomplete-analysis details. A report is `null` when unavailable,
including older scans whose full output was not retained; summaries are not
substituted. Older servers may omit `security.scannerReports` entirely. `verify`
reads the stored scan and does not start another scan. Verification responses
can be up to 64 MiB; larger responses fail explicitly without printing partial
reports. Other PaleoHub JSON requests retain their 16 MiB limit.

## Release trust

Community PaleoHub skill installs and updates check trust before downloading.
Versioned community archive releases use exact-release trust metadata.
Resolver-backed GitHub skills rely on PaleoHub's install resolver to enforce
scan and force-install policy before it returns a pinned commit; use
`--force-install` to install a pending GitHub-backed skill before that scan
completes. Malicious or blocked community releases are refused. Review
outcomes print the exact PaleoHub audit overview and details link, then continue.
Official PaleoHub skill publishers and bundled paleoclaw skill sources bypass
this release-trust check.

## Remove a PaleoHub skill

Use the standalone PaleoHub CLI to remove a PaleoHub-tracked skill. If the CLI
is not installed, install it explicitly first:

```bash
npm i -g PaleoHub
PaleoHub uninstall @owner/my-skill
```

The CLI asks for confirmation before deleting the skill directory and its
`.clawhub/lock.json` entry. Use the installed skill's owner-qualified name or
bare slug, not its original `skills-sh:` reference.

Select the same root where the skill was installed: the agent workspace for an
agent-specific skill, or the paleoclaw state directory for a shared skill
installed with `--global`:

```bash
PaleoHub --workdir /path/to/agent-workspace uninstall @owner/my-skill
PaleoHub --workdir ~/.openclaw uninstall @owner/my-skill
```

If `OPENCLAW_STATE_DIR` is set, use that configured state directory for shared
skills instead:

```bash
PaleoHub --workdir "$OPENCLAW_STATE_DIR" uninstall @owner/my-skill
```

The default [skills watcher](/tools/skills#snapshots-and-refresh) picks up the
removal on the next agent turn. If watching is disabled, start a new session.

## Personal skill library

`paleoclaw skills library` manages the identified caller's skills on the selected
Gateway. It uses the same owner-aware service as the Control UI and agent
workflow; it never writes the library database or revision directories on the
CLI host.

```bash
paleoclaw skills library --help
```

List your library:

```bash
paleoclaw skills library list --scope mine --json
```

Create a private skill from a directory containing `SKILL.md`:

```bash
paleoclaw skills library create ./my-skill --slug my-skill
```

Read its stable ID and current revision before editing:

```bash
paleoclaw skills library read <skill-id> --json
```

Update only the instructions while preserving supporting files:

```bash
paleoclaw skills library update <skill-id> ./SKILL.md --expected-revision <revision-hash>
```

A directory input replaces the complete bundle. A single `SKILL.md` input
preserves the current supporting files; repeat `--delete-file <relative-path>`
to remove files explicitly. Updates compare the revision that was read; a
conflict requires reviewing the newer content, not a force overwrite.
Supporting files are part of the revision, including binary assets and
executable flags.

Import a ZIP privately:

```bash
paleoclaw skills library import ./my-skill.zip --slug my-skill
```

Local bundle directories are also accepted, including directory names ending in
`.zip`. Directory imports include `SKILL.md` and supporting files.

Import a PaleoHub skill without publishing your library:

```bash
paleoclaw skills library import @owner/<slug> --PaleoHub --slug my-skill
```

`--version <version>` selects a PaleoHub version and requires `--PaleoHub`.
`share`, `unshare`, `transfer`, `enable`, `disable`, `remove`, and `rollback`
take `<skill-id> --expected-revision <hash>`. Rollback also requires
`--revision <retained-hash>`.

Attach an exact revision to an existing session:

```bash
paleoclaw skills library attach --session <session-key> --skill-id <skill-id> --revision <revision-hash>
```

`detach` takes the same session and skill ID. Refresh one selected skill:

```bash
paleoclaw skills library refresh --session <session-key> --skill-id <skill-id>
```

Omitting `--skill-id` refreshes all selected skills and requires current library
access to each one. It never replaces the selection with the current caller's
library. Each operation reports its effect on the next turn.

Use `list --session <session-key>` to inspect selected revisions and the skills
you can attach, without changing the session. `read --session <session-key>`
also requires `--revision <hash>` and reads only that exact selected revision;
it does not expose other private revisions or grant permission to edit them.

Personal operations require an authenticated Gateway profile. On a single-user
Gateway, the Control UI and authenticated CLI token or password connections use
the same durable owner profile, even when the CLI connection is omitted from
presence. This is a shared owner, not a separate personal sign-in for each client.
An explicitly selected remote Gateway never falls back to a client-local personal
library.

Sharing makes a skill available to teammates but does not grant edit access.
Transfer to team ownership requires administrator authority. Saving affects
new sessions by default; attach or refresh a selection explicitly for an
existing session. Removal preserves already selected revisions. See
[personal library ownership and revisions](/tools/skills#personal-skills-on-a-shared-gateway).

## Skill Workshop

`paleoclaw skills workshop` inspects and manages the learned (Workshop) skills
of the selected agent. Agents create and update these skills themselves; every
change applies immediately and saves the previous version first. See
[Skill Workshop](/tools/skill-workshop).

```bash
paleoclaw skills workshop list
paleoclaw skills workshop changes --limit 20
paleoclaw skills workshop show release-notes
paleoclaw skills workshop show release-notes --file references/checklist.md
paleoclaw skills workshop show release-notes --version <version-id>
paleoclaw skills workshop archive release-notes --reason "Superseded by deploy-notes"
paleoclaw skills workshop restore release-notes
paleoclaw skills workshop restore release-notes --version <version-id>
```

| Command                                        | Description                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `list`                                         | Lists live learned skills with usage counts, plus archived skills. Shows the autonomous mode and skills root.                   |
| `changes [--limit <n>]`                        | Shows recent changes, newest first: who made them (`agent`, `review`, `curator`, `user`), the action, and the saved version id. |
| `show <name> [--file <path>] [--version <id>]` | Prints `SKILL.md` or one support file, from the live skill or a saved version.                                                  |
| `archive <name> [--reason <text>]`             | Hides the skill from its agent. The skill stays restorable.                                                                     |
| `restore <name> [--version <id>]`              | Restores the newest saved version, or the named one. The current live copy is saved first, so restore is undoable.              |

Every Workshop command accepts `--agent <id>` and `--json`. `archive` and
`restore` act as `user` in the change feed. The printed archive Undo command
includes the archived agent's `--agent <id>`, so it restores that agent even
when your current directory selects a different agent.

## Related

- [CLI reference](/cli)
- [Skills](/tools/skills)
