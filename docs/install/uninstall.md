---
summary: "Uninstall paleoclaw completely (CLI, service, state, workspace)"
read_when:
  - You want to remove paleoclaw from a machine
  - The gateway service is still running after uninstall
title: "Uninstall"
---

# Uninstall

Two paths:

- **Easy path** if `paleoclaw` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
paleoclaw uninstall
```

Non-interactive (automation / npx):

```bash
paleoclaw uninstall --all --yes --non-interactive
npx -y paleoclaw uninstall --all --yes --non-interactive
```

Manual steps (same result):

1. Stop the gateway service:

```bash
paleoclaw gateway stop
```

2. Uninstall the gateway service (launchd/systemd/schtasks):

```bash
paleoclaw gateway uninstall
```

3. Delete state + config:

```bash
rm -rf "${OPENCLAW_STATE_DIR:-$HOME/.paleoclaw}"
```

If you set `OPENCLAW_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4. Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.paleoclaw/workspace
```

5. Remove the CLI install (pick the one you used):

```bash
npm rm -g paleoclaw
pnpm remove -g paleoclaw
bun remove -g paleoclaw
```

6. If you installed the macOS app:

```bash
rm -rf /Applications/paleoclaw.app
```

Notes:

- If you used profiles (`--profile` / `OPENCLAW_PROFILE`), repeat step 3 for each state dir (defaults are `~/.paleoclaw-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `paleoclaw` is missing.

### macOS (launchd)

Default label is `ai.paleoclaw.gateway` (or `ai.paleoclaw.<profile>`; legacy `com.paleoclaw.*` may still exist):

```bash
launchctl bootout gui/$UID/ai.paleoclaw.gateway
rm -f ~/Library/LaunchAgents/ai.paleoclaw.gateway.plist
```

If you used a profile, replace the label and plist name with `ai.paleoclaw.<profile>`. Remove any legacy `com.paleoclaw.*` plists if present.

### Linux (systemd user unit)

Default unit name is `paleoclaw-gateway.service` (or `paleoclaw-gateway-<profile>.service`):

```bash
systemctl --user disable --now paleoclaw-gateway.service
rm -f ~/.config/systemd/user/paleoclaw-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `paleoclaw Gateway` (or `paleoclaw Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "paleoclaw Gateway"
Remove-Item -Force "$env:USERPROFILE\.paleoclaw\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.paleoclaw-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://paleoclaw.ai/install.sh` or `install.ps1`, the CLI was installed with `npm install -g paleoclaw@latest`.
Remove it with `npm rm -g paleoclaw` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `paleoclaw ...` / `bun run paleoclaw ...`):

1. Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2. Delete the repo directory.
3. Remove state + workspace as shown above.
