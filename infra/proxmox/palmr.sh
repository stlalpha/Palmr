#!/usr/bin/env bash
source <(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/build.func)
# Copyright (c) 2021-2026 community-scripts ORG
# Author: stlalpha (Jim McBride) — adapted from prior community-scripts entry by vhsdream
# License: MIT
# Source: https://github.com/stlalpha/Palmr

APP="Palmr"
var_tags="${var_tags:-files;sharing}"
var_cpu="${var_cpu:-2}"
var_ram="${var_ram:-2048}"
var_disk="${var_disk:-8}"
var_os="${var_os:-debian}"
var_version="${var_version:-13}"
var_unprivileged="${var_unprivileged:-1}"

header_info "$APP"
variables
color
catch_errors

# This is a Docker-based deployment. The container runs ghcr.io/stlalpha/palmr,
# which bundles MinIO, the Fastify API, the Next.js web app, and supervisord.
# Update is just `docker compose pull && docker compose up -d`.

function update_script() {
  header_info
  check_container_storage
  check_container_resources
  if [[ ! -d /opt/palmr ]]; then
    msg_error "No ${APP} Installation Found!"
    exit 1
  fi
  msg_info "Pulling latest ${APP} image"
  cd /opt/palmr
  $STD docker compose pull
  msg_ok "Pulled latest image"

  msg_info "Restarting ${APP}"
  $STD docker compose up -d
  msg_ok "Restarted ${APP}"

  msg_ok "Updated successfully!"
  exit
}

start
build_container
description

msg_ok "Completed successfully!\n"
echo -e "${CREATING}${GN}${APP} setup has been successfully initialized!${CL}"
echo -e "${INFO}${YW} Access the web UI at:${CL}"
echo -e "${TAB}${GATEWAY}${BGN}http://${IP}:5487${CL}"
echo -e "${INFO}${YW} The bundled storage system listens on port 9379 and the API on port 3333.${CL}"
