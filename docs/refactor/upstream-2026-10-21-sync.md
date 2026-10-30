---
summary: "State of the upstream openclaw 2026-10-21 sync: what this branch already fixed, what is still stale, and how to measure the gap"
read_when:
  - Picking up the remaining upstream sync work on a native or TypeScript tree
  - Deciding whether a build failure is a rebrand regression or an upstream sync gap
  - Estimating how much of the fork still diverges from the upstream snapshot
title: "Upstream 2026-10-21 sync: remaining gap"
---

# Upstream 2026-10-21 sync: remaining gap

The fork merged the upstream openclaw tree of 2026-10-21. The merge was a
**partial** sync: some directories took upstream's files wholesale, others kept
the fork's older copies. Both halves now sit in the same module, which is the
root cause of most of the build failures this branch fixed.

This document records what is already done, what is still stale, and how to
measure the gap without guessing.

## Already fixed on this branch

| Area                    | Root cause                                                                                                                                                                             | Symptom it produced                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Rust crate names        | Renaming a Cargo package renames its library (`openclaw_gateway_client` -> `paleoclaw_gateway_client`), but the `use` statements were left behind                                      | One unresolved import plus six cascading `E0599` errors                                                      |
| Rust formatting         | `openclaw` (7 characters) to `paleoclaw` (9) pushed three lines past the width budget                                                                                                  | `cargo fmt --check` failed the Linux companion build                                                         |
| Shell script modes      | Renaming a file drops the executable bit on platforms where git cannot read it from the filesystem                                                                                     | `EACCES` when a workflow spawned `scripts/stage-paleoclaw-bun.sh`                                            |
| Third-party coordinates | The Bun runtime is published by `openclaw/bun` and signed by the OpenClaw Foundation, but the rebranded fork expected a `paleoclaw/bun` repository and a `paleoclaw Foundation` signer | The desktop build failed before downloading anything                                                         |
| Package manager         | pnpm 10 writes a `.` segment into packed tar entry paths, and pnpm 12 refuses to install when a dependency with a build script is missing from `allowBuilds`                           | The bundled browser MCP tarball was rejected; `sharp` (used by the morphometric skill) blocked every install |
| Swift module scope      | Upstream moved types into new files and rewrote others; the fork kept the old copies, so the same type was declared twice in one module                                                | 952 Swift compile errors, all before a single app file compiled                                              |
| SwiftPM manifests       | The Xcode project is generated from `apps/ios/project.yml`, whose name is `paleoclaw`; the watch app was still declared as a watchOS 1 container; the mermaid bundle is generated      | XcodeGen refused to generate the project, then the watch app was emitted twice                               |
| Vite configuration      | A Vite config that fails to load silently drops its `resolve.alias`, so the build then cannot resolve a workspace package that only exposes built entry points                         | `failed to load config from ...` followed by a misleading "no runtime resolution" error                      |
| Root dependency ranges  | `pnpm-workspace.yaml` overrides rewrite the resolved version, but the manifest kept the pre-override range                                                                             | The npm package lock generator rejected the root dependency set                                              |

## What is still stale

Measured against the upstream snapshot, after this branch:

| Tree                                             | Files | Identical to upstream | Genuinely different |
| ------------------------------------------------ | ----- | --------------------- | ------------------- |
| `apps/macos/Sources/OpenClaw`                    | 377   | 234                   | 108                 |
| `apps/shared/OpenClawKit/Sources/OpenClawKit`    | 115   | 104                   | 11                  |
| `apps/shared/OpenClawKit/Sources/OpenClawChatUI` | 185   | 169                   | 16                  |
| `src/` (TypeScript)                              | -     | -                     | 2052                |

The three biggest ChatUI files (`ChatComposer.swift`, `ChatView.swift`,
`ChatViewModel.swift`, roughly 3800 lines together) are still the fork's
older versions. The OpenClawChatUI target already contains upstream's
`ChatFullMessageReader.swift`, which expects the newer view model, so the
target cannot compile until all three move together.

The TypeScript side carries the same shape of gap: the fork's `src/` imports
the package layer directly, upstream's does not. That is why the fork's root
`package.json` declares `@paleoclaw/*` workspace packages that upstream does
not, and why the native builds need those packages built before the UI build
runs.

## How to measure the gap

Do not eyeball this. Three techniques cover it:

1. **Brand-normalised file comparison.** Normalise `paleoclaw` -> `openclaw`,
   `PaleoHub` -> `ClawHub` in both trees, then compare file by file. A file
   that differs only by the brand is fine; a file that differs in content is
   stale. This is what produced the table above.
2. **Declaration-graph scan.** Parse the top-level `protocol`, `struct`,
   `enum`, `actor`, `class` and `typealias` declarations of every Swift file
   in a target and look for the same name twice. Exclude names inside
   `#if os(...)` blocks (platform variants are legal) and `private` names
   (file scope, so two files may share one).
3. **Import-graph trace.** To find which workspace packages a Vite config
   needs built, walk the runtime imports from the config file, skipping
   `import type` (erased at compile time), and collect the bare package
   specifiers that resolve into the workspace.

## Recommended order of work

1. Restore the three ChatUI files from upstream, together, in one change.
2. Restore the remaining OpenClawKit files (11) and the macOS app target
   (108), in batches, keeping the brand normalisation.
3. Land the TypeScript side (`src/`, 2052 files) last, because the native
   trees depend on its generated protocol types.
4. After each batch, re-run `pnpm build` and the macOS and iOS periphery
   workflows; they are the only jobs that compile the native trees.

## Verification

- `pnpm build` and `pnpm build:ci-artifacts` must stay green.
- The `macOS Periphery` and `iOS Periphery` workflows must pass; they compile
  the native trees and report dead code.
- `native:i18n:check` must stay green.
- The Swift compile error count is the fastest signal: this branch took the
  macOS build from 952 errors to zero without a local Swift toolchain, by
  reading the CI logs and comparing against upstream.
