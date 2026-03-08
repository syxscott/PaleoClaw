---
name: PaleoHub
description: Use the PaleoHub CLI to search, install, update, and publish agent skills from paleohub.org. Use when you need to fetch new skills on the fly, sync installed skills to latest or a specific version, or publish new/updated skill folders with the npm-installed PaleoHub CLI.
metadata:
  {
    "paleoclaw":
      {
        "requires": { "bins": ["PaleoHub"] },
        "install":
          [
            {
              "id": "node",
              "kind": "node",
              "package": "PaleoHub",
              "bins": ["PaleoHub"],
              "label": "Install PaleoHub CLI (npm)",
            },
          ],
      },
  }
---

# PaleoHub CLI

Install

```bash
npm i -g PaleoHub
```

Auth (publish)

```bash
PaleoHub login
PaleoHub whoami
```

Search

```bash
PaleoHub search "postgres backups"
```

Install

```bash
PaleoHub install my-skill
PaleoHub install my-skill --version 1.2.3
```

Update (hash-based match + upgrade)

```bash
PaleoHub update my-skill
PaleoHub update my-skill --version 1.2.3
PaleoHub update --all
PaleoHub update my-skill --force
PaleoHub update --all --no-input --force
```

List

```bash
PaleoHub list
```

Publish

```bash
PaleoHub publish ./my-skill --slug my-skill --name "My Skill" --version 1.2.0 --changelog "Fixes + docs"
```

Notes

- Default registry: https://paleohub.org (override with PaleoHub_REGISTRY or --registry)
- Default workdir: cwd (falls back to paleoclaw workspace); install dir: ./skills (override with --workdir / --dir / PaleoHub_WORKDIR)
- Update command hashes local files, resolves matching version, and upgrades to latest unless --version is set
