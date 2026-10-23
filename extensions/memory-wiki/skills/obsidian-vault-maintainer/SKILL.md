---
name: obsidian-vault-maintainer
description: Maintain an Obsidian-friendly memory wiki vault with wikilinks, frontmatter, and official Obsidian CLI awareness.
---

Use this skill when the memory-wiki vault render mode is `obsidian` or the user wants the wiki to play nicely with Obsidian.

- Start from `paleoclaw wiki status` to confirm the vault mode and whether the official Obsidian CLI is available.
- Use `paleoclaw wiki obsidian status` before shelling out, then prefer the dedicated helpers like `paleoclaw wiki obsidian search`, `paleoclaw wiki obsidian open`, `paleoclaw wiki obsidian command`, and `paleoclaw wiki obsidian daily`.
- Prefer `[[Wikilinks]]`, stable filenames, and frontmatter that works with Obsidian dashboards and Dataview-style queries.
- Keep generated sections repeatable so Obsidian users can safely add handwritten notes around them.
- If the official Obsidian CLI is enabled, check that it works before depending on it. Do not assume the app is installed, running, or configured.
- Pair renames with link repair.
