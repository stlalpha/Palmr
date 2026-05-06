# Proxmox VE helper script

Docker-based LXC installer for Palmr in the style of [community-scripts/ProxmoxVE](https://github.com/community-scripts/ProxmoxVE).

## What it does

Creates a Debian 13 unprivileged LXC container, installs Docker (official repo, current engine + compose plugin), pulls `ghcr.io/stlalpha/palmr:latest`, writes a `docker-compose.yml` to `/opt/palmr/`, starts the stack, and creates a systemd unit so the stack survives host reboot.

Default sizing: 2 CPU, 2GB RAM, 8GB disk. Override with `var_cpu`, `var_ram`, `var_disk` env vars before running `palmr.sh`.

## Files

| File | Purpose |
|---|---|
| `palmr.sh` | Run on the **Proxmox host**. Sources `community-scripts`' build framework, creates the LXC, runs `palmr-install.sh` inside it. |
| `palmr-install.sh` | Runs **inside the LXC**. Installs Docker, writes the compose file, pulls the image, starts the stack, creates the systemd unit. |
| `palmr.json` | Metadata for the community-scripts site (categories, default sizing, port, etc). |

## How to run it

From a Proxmox host shell, with our scripts hosted on a public URL:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/stlalpha/Palmr/main/infra/proxmox/palmr.sh)"
```

That sources `build.func` from community-scripts (their host-side framework — handles container creation, the standard prompts, error handling, etc.) and then calls `palmr-install.sh` from this same path inside the new LXC. The install script's location resolves automatically through community-scripts' build framework.

After completion, the script prints the LXC's IP and the URL — `http://<lxc-ip>:5487`.

## Update / uninstall

Inside the LXC:

```bash
cd /opt/palmr
docker compose pull && docker compose up -d   # update
docker compose down                            # stop
```

Or from the Proxmox host, re-run `palmr.sh` and choose the update path at the prompt.

## STORAGE_URL — the one thing you'll likely tweak

The bundled MinIO listens on port 9379. Presigned URLs returned to clients reference `STORAGE_URL`, which **must be reachable from the user's browser**. Install detects the LXC's first IPv4 and uses that — fine for single-host home-lab use. For anything else (DNS hostname, reverse proxy, Tailscale, etc.) override the value in `/opt/palmr/docker-compose.yml` and `docker compose up -d`.

If running behind an HTTPS reverse proxy, also set `SECURE_SITE: "true"` in the compose file.

## Upstreaming to community-scripts/ProxmoxVE

The previous Palmr entry there (deleted in [PR #12399](https://github.com/community-scripts/ProxmoxVE/pull/12399) when upstream archived) used a source-build approach with two systemd units. This rewrite is Docker-based because the current Palmr ships bundled MinIO + supervisord — replicating that natively would mean reimplementing ~263 lines of Dockerfile.

If you want to PR these into community-scripts/ProxmoxVE:

1. Fork the repo.
2. Copy `palmr.sh` → `ct/palmr.sh`.
3. Copy `palmr-install.sh` → `install/palmr-install.sh`.
4. Copy `palmr.json` → `frontend/public/json/palmr.json`.
5. Open a PR, link to the deletion PR (#12399) for context, note the deployment-model change.

The community-scripts maintainers are usually fine with Docker-based scripts; `homeassistant-install.sh` is a precedent already in their tree.
