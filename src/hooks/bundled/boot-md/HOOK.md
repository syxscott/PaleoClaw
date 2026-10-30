---
name: boot-md
description: "Run BOOT.md on gateway startup"
homepage: https://docs.paleoclaw.ai/automation/hooks#boot-md
metadata:
  {
    "paleoclaw":
      {
        "emoji": "🚀",
        "events": ["gateway:startup"],
        "requires": { "config": ["workspace.dir"] },
        "install": [{ "id": "bundled", "kind": "bundled", "label": "Bundled with paleoclaw" }],
      },
  }
---

# Boot Checklist Hook

Runs `BOOT.md` at Gateway startup once per distinct configured agent workspace,
if the file exists there. Agents sharing a workspace do not run the same checklist
again. Enable with `paleoclaw hooks enable boot-md`, then restart the Gateway.
