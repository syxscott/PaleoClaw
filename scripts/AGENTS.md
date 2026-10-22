# Scripts Guide

Own local tooling, script wrappers, generated-artifact helper rules.

## Ownership Map

- Tests: `run-vitest.mjs`; follow [testing skill](../.agents/skills/paleoclaw-testing/SKILL.md) + [test-authoring skill](../.agents/skills/test-audit/SKILL.md).
- Lint/typecheck: `run-oxlint.mjs` + `run-tsgo.mjs` own repo-local runtime behavior; use them in package scripts and CI steps.
- Changed-file checks: `check-changed.mjs` owns execution; `changed-lanes.mjs` owns classification. Never copy path-scope rules into hooks/CI snippets.
- PR preparation: `pr` / `pr-lib` own source acquisition, correction reviews, gate bindings. Changing them: read [PR preparation](../docs/reference/scripts/pr-preparation.md).
- PR wrapper lifecycle: `pr` / `pr-lib` own supervision, locks, materialized dependencies. Changing/repairing them: read [PR wrapper tooling](../docs/reference/scripts/pr-tooling.md).
- GitHub transport: `pr-lib` owns observations + protected dispatch. Changing API/Octopool behavior: read [PR GitHub transport](../docs/reference/scripts/github-transport.md).
- Merge admission/recovery: `pr-lib` owns policy, retained outcomes, completion. Read [merge admission](../docs/reference/scripts/merge-admission.md), [merge recovery](../docs/reference/scripts/merge-recovery.md), or [prior-CI admin admission](../docs/reference/scripts/prior-ci.md) for that operation.
- Remote proof: `crabbox-wrapper.mjs` owns source capsules; `.github/actions/prepare-testbox-shell` owns shell/cwd. Changing them: read [remote gate contracts](../docs/reference/scripts/remote-gates.md). Operating boxes: use [Crabbox skill](../.agents/skills/crabbox/SKILL.md).
- Generated artifacts: align source generator, package script, verification command. Prefer `*:gen` / `*:check` pairs over undocumented one-offs.

## Wrapper Rules

- macOS-only Bash scripts: `#!/bin/bash`, Bash 3.2-compatible syntax. Invoke directly or with `/bin/bash`, including fixtures. Add new entrypoints to `nativeScripts` in `test/scripts/build-and-run-mac.test.ts`.
- Portable Bash entrypoints using heredocs/here-strings (including sourced helpers): copy the Darwin Bash 5.3+ re-exec guard from `test/scripts/build-and-run-mac.test.ts` before those operations (prevents heredoc pipe deadlocks) and add the file to `portableScripts`. stdin/sourced installers: request `/bin/bash` when replay impossible.
- Tests: run through `scripts/run-vitest.mjs` or root `pnpm test ...`; bare `vitest ...` starts local watch mode unless `run` or `--run` explicit.
- macOS CI workflow changes: run all `test/scripts/ci-workflow*.test.ts`, including failure-collection cases in `ci-workflow-complete.test.ts`, plus `ci-swift-cache-lifetime.test.ts`, `macos-native-test-launch.test.ts`, and `macos-native-runtime-artifact.test.ts`; validate workflows with `scripts/check-workflows.mts`.
- Lint (one/few files): direct `node scripts/run-oxlint.mjs --tsconfig <matching config> <files...>`, not sharded `pnpm lint`.

## TypeScript Syntax

- `scripts/**` TypeScript implementation files: erasable by Node without transformation; `pnpm check:script-erasability` enforces it.
- Native Node execution: opt-in per entrypoint + import closure, only when runtime imports stay Node-resolvable. Keep `tsx` for closures depending on source runtime trees, frozen checkouts, package aliases, or tsconfig/path resolution.

## PR Safety

- PR operations: follow [maintainer workflow](../.agents/skills/paleoclaw-pr-maintainer/SKILL.md). Gate modes: [landing](../.agents/skills/paleoclaw-pr-maintainer/references/landing.md). Default handoff: `merge-run --auto-merge`. Pending admission ≠ successful proof/merge completion.
- Landing subcommands require canonical/origin-main wrapper code. Never bypass wrapper trust, operation locks, exact-head review/gate bindings, live authority checks, or Octopool string rewrite protection; never select raw `gh` to get landing through.
- Before returning: join all PR-state-mutating children. Drained self-exited failures auto-release their operation lock; interrupted/uncertain locks stay held — verify no child tools remain before reported exact-OID `scripts/pr lock-recover` command. Never delete lock refs manually.
- Preserve transition journals, preparation evidence, outcome refs, captures. Never clear/push `refs/paleoclaw/pr-merge-outcomes/<PR>`, hand-edit receipts, or infer non-execution from failed command, elapsed time, absent process, or open PR.
- Accepted/pending/uncertain writes: investigate through [native recovery](../docs/reference/scripts/merge-recovery.md). Never blindly resubmit/switch transports. Existing land authority covers investigated same-scope recovery, not gate bypasses/new scope/method.
- Before comments/ownership-checked cleanup: confirm merge receipt. Completion comments: one attempt; reconcile uncertain comments by marker. Preserve worktrees/captures with unresolved outcome; never delete recreated branch by name.

## Execution Gotchas

- Fs-safe dependency trouble: follow [on-demand vendoring instructions](vendor-fs-safe.md); vendor contents local, registry dependencies default.
- Trusted normal checkout missing dependencies: `pnpm install --frozen-lockfile`, retry once before diagnosing code defect.
- Formatting: `pnpm format` defaults locally to the pinned Bun fork, with an oxfmt fallback; `OPENCLAW_FORMAT_TOOL=oxfmt` forces oxfmt. CI checks oxfmt/Bun parity. Generated-artifact gates retain oxfmt; see [caller inventory](README.md#formatting-and-lint-selection). Typechecking: repository `tsgo` lanes. Scope: `pnpm changed:lanes --json`; targeted tests/checks. Avoiding worktree reconciliation: `node scripts/run-vitest.mjs` with ready dependencies.

---

# Operational Runbooks

## exe.dev VM ops (general)

- Access: stable path is `ssh exe.dev` then `ssh vm-name` (assume SSH key already set).
- SSH flaky: use exe.dev web terminal or Shelley (web agent); keep a tmux session for long ops.
- Update: `sudo npm i -g paleoclaw@latest` (global install needs root on `/usr/lib/node_modules`).
- Config: use `paleoclaw config set ...`; ensure `gateway.mode=local` is set.
- Discord: store raw token only (no `DISCORD_BOT_TOKEN=` prefix).
- Restart: stop old gateway and run:
  `pkill -9 -f paleoclaw-gateway || true; nohup paleoclaw gateway run --bind loopback --port 18789 --force > /tmp/paleoclaw-gateway.log 2>&1 &`
- Verify: `paleoclaw channels status --probe`, `ss -ltnp | rg 18789`, `tail -n 120 /tmp/paleoclaw-gateway.log`.

## Shorthand Commands

- `sync`: if working tree is dirty, commit all changes (pick a sensible Conventional Commit message), then `git pull --rebase`; if rebase conflicts and cannot resolve, stop; otherwise `git push`.

## Git Notes

- If `git branch -d/-D <branch>` is policy-blocked, delete the local ref directly: `git update-ref -d refs/heads/<branch>`.
- Bulk PR close/reopen safety: if a close action would affect more than 5 PRs, first ask for explicit user confirmation with the exact PR count and target scope/query.

## GitHub Search (`gh`)

- Prefer targeted keyword search before proposing new work or duplicating fixes.
- Use `--repo paleoclaw/paleoclaw` + `--match title,body` first; add `--match comments` when triaging follow-up threads.
- PRs: `gh search prs --repo paleoclaw/paleoclaw --match title,body --limit 50 -- "auto-update"`
- Issues: `gh search issues --repo paleoclaw/paleoclaw --match title,body --limit 50 -- "auto-update"`
- Structured output example:
  `gh search issues --repo paleoclaw/paleoclaw --match title,body --limit 50 --json number,title,state,url,updatedAt -- "auto update" --jq '.[] | "\(.number) | \(.state) | \(.title) | \(.url)"'`

## GHSA (Repo Advisory) Patch/Publish

- Before reviewing security advisories, read `SECURITY.md`.
- Fetch: `gh api /repos/paleoclaw/paleoclaw/security-advisories/<GHSA>`
- Latest npm: `npm view paleoclaw version --userconfig "$(mktemp)"`
- Private fork PRs must be closed:
  `fork=$(gh api /repos/paleoclaw/paleoclaw/security-advisories/<GHSA> | jq -r .private_fork.full_name)`
  `gh pr list -R "$fork" --state open` (must be empty)
- Description newline footgun: write Markdown via heredoc to `/tmp/ghsa.desc.md` (no `"\\n"` strings)
- Build patch JSON via jq: `jq -n --rawfile desc /tmp/ghsa.desc.md '{summary,severity,description:$desc,vulnerabilities:[...]}' > /tmp/ghsa.patch.json`
- GHSA API footgun: cannot set `severity` and `cvss_vector_string` in the same PATCH; do separate calls.
- Patch + publish: `gh api -X PATCH /repos/paleoclaw/paleoclaw/security-advisories/<GHSA> --input /tmp/ghsa.patch.json` (publish = include `"state":"published"`; no `/publish` endpoint)
- If publish fails (HTTP 422): missing `severity`/`description`/`vulnerabilities[]`, or private fork has open PRs
- Verify: re-fetch; ensure `state=published`, `published_at` set; `jq -r .description | rg '\\\\n'` returns nothing

## NPM + 1Password (publish/verify)

- Use the 1password skill; all `op` commands must run inside a fresh tmux session.
- Correct 1Password path for npm release auth: `op://Private/Npmjs` (use that item; OTP stays `op://Private/Npmjs/one-time password?attribute=otp`).
- Sign in: `eval "$(op signin --account my.1password.com)"` (app unlocked + integration on).
- OTP: `op read 'op://Private/Npmjs/one-time password?attribute=otp'`.
- Publish: `npm publish --access public --otp="<otp>"` (run from the package dir).
- Verify without local npmrc side effects: `npm view <pkg> version --userconfig "$(mktemp)"`.
- Kill the tmux session after publish.

## Plugin Release Fast Path (no core `paleoclaw` publish)

- Release only already-on-npm plugins. Source list is in `docs/reference/RELEASING.md` under "Current npm plugin list".
- Run all CLI `op` calls and `npm publish` inside tmux to avoid hangs/interruption:
  - `tmux new -d -s release-plugins-$(date +%Y%m%d-%H%M%S)`
  - `eval "$(op signin --account my.1password.com)"`
- 1Password helpers:
  - password used by `npm login`:
    `op item get Npmjs --format=json | jq -r '.fields[] | select(.id=="password").value'`
  - OTP:
    `op read 'op://Private/Npmjs/one-time password?attribute=otp'`
- Fast publish loop (local helper script in `/tmp` is fine; keep repo clean):
  - compare local plugin `version` to `npm view <name> version`
  - only run `npm publish --access public --otp="<otp>"` when versions differ
  - skip if package is missing on npm or version already matches.
- Keep `paleoclaw` untouched: never run publish from repo root unless explicitly requested.
- Post-check for each release:
  - per-plugin: `npm view @paleoclaw/<name> version --userconfig "$(mktemp)"` should be `2026.2.17`
  - core guard: `npm view paleoclaw version --userconfig "$(mktemp)"` should stay at previous version unless explicitly requested.

## Changelog Release Notes

- When cutting a mac release with beta GitHub prerelease:
  - Tag `vYYYY.M.D-beta.N` from the release commit (example: `v2026.2.15-beta.1`).
  - Create prerelease with title `paleoclaw YYYY.M.D-beta.N`.
  - Use release notes from `CHANGELOG.md` version section (`Changes` + `Fixes`, no title duplicate).
  - Attach at least `paleoclaw-YYYY.M.D.zip` and `paleoclaw-YYYY.M.D.dSYM.zip`; include `.dmg` if available.

- Keep top version entries in `CHANGELOG.md` sorted by impact:
  - `### Changes` first.
  - `### Fixes` deduped and ranked with user-facing fixes first.
- Before tagging/publishing, run:
  - `node --import tsx scripts/release-check.ts`
  - `pnpm release:check`
  - `pnpm test:install:smoke` or `OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT=1 pnpm test:install:smoke` for non-root smoke path.
