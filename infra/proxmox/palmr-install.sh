#!/usr/bin/env bash

# Copyright (c) 2021-2026 community-scripts ORG
# Author: stlalpha (Jim McBride) — adapted from prior community-scripts entry by vhsdream
# License: MIT
# Source: https://github.com/stlalpha/Palmr

source /dev/stdin <<<"$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

msg_info "Installing Dependencies"
$STD apt-get install -y curl ca-certificates gnupg lsb-release
msg_ok "Installed Dependencies"

msg_info "Installing Docker"
# Docker official repo — keeps engine + compose plugin current rather than
# the older versions in Debian's archive.
install -m 0755 -d /etc/apt/keyrings
$STD curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  >/etc/apt/sources.list.d/docker.list
$STD apt-get update
$STD apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
msg_ok "Installed Docker"

msg_info "Configuring Palmr stack"
PALMR_DIR="/opt/palmr"
mkdir -p "$PALMR_DIR"
cd "$PALMR_DIR" || {
  msg_error "Failed to enter $PALMR_DIR"
  exit 1
}

# The bundled storage exposes its S3 API on port 9379. Presigned URLs returned
# to clients use STORAGE_URL — must be reachable from wherever the user opens
# their browser. We default to the LXC's primary IPv4 so single-host setups
# work out of the box; reverse-proxy users will want to override after install.
DETECTED_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [[ -z "$DETECTED_IP" ]]; then
  # Fallback: ask the kernel which source address it'd use for outbound traffic.
  DETECTED_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '/src/ {for (i=1;i<=NF;i++) if ($i=="src") print $(i+1)}')"
fi
if [[ -z "$DETECTED_IP" ]]; then
  msg_info "Could not detect an IPv4 address; defaulting STORAGE_URL to 127.0.0.1 — update /opt/palmr/docker-compose.yml after install"
  DETECTED_IP="127.0.0.1"
fi

cat <<EOF >"$PALMR_DIR/docker-compose.yml"
services:
  palmr:
    image: ghcr.io/stlalpha/palmr:latest
    container_name: palmr
    restart: unless-stopped
    environment:
      # REQUIRED for the bundled storage system. Must be reachable by the
      # browser. Set to a stable URL in production (https://palmr.example.com:9379
      # or similar). Detected default uses the LXC's first IPv4.
      STORAGE_URL: "http://${DETECTED_IP}:9379"
      # Set to true if Palmr is behind an HTTPS reverse proxy.
      # SECURE_SITE: "true"
    ports:
      - "5487:5487"   # Web UI
      - "3333:3333"   # API
      - "9379:9379"   # Bundled storage (S3-compatible) — must be reachable by the browser
    volumes:
      - palmr_data:/app/server

volumes:
  palmr_data:
EOF

# Pull image up front so build_container's progress dots reflect actual work
# rather than just docker-compose noise. First pull is large (~300MB) and
# slow; subsequent updates only fetch changed layers.
msg_info "Pulling Palmr image (this may take a few minutes)"
$STD docker compose pull
msg_ok "Pulled Palmr image"

msg_info "Starting Palmr"
$STD docker compose up -d
msg_ok "Started Palmr"

msg_info "Creating systemd unit for Palmr"
# Compose's restart policy handles container-level restarts. This unit just
# ensures the stack starts on host boot independently of docker.service order
# and gives admins `systemctl status palmr` for at-a-glance health.
cat <<EOF >/etc/systemd/system/palmr.service
[Unit]
Description=Palmr Docker Compose stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=true
WorkingDirectory=$PALMR_DIR
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
ExecReload=/bin/sh -c '/usr/bin/docker compose pull && /usr/bin/docker compose up -d'

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable -q palmr
msg_ok "Created systemd unit"

motd_ssh
customize
cleanup_lxc
