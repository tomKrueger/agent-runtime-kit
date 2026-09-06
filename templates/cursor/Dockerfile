# Agent Runtime Kit — shared Cursor Cloud Agent image
#
# Managed copy target: consumer `.cursor/Dockerfile` (written by `agent-runtime sync`).
# Do not COPY the app repo — Cursor checks out the workspace at runtime.
# Prefer baking Docker + Supabase CLI here so `cursor-install` is mostly a no-op.
#
# See https://cursor.com/docs/cloud-agent/setup
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ARG SUPABASE_CLI_VERSION=2.114.0

########################################################
# Base tooling (Cursor Cloud Agents require git + sudo)
########################################################
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    xz-utils \
    git \
    sudo \
    fuse-overlayfs \
    iptables \
  && rm -rf /var/lib/apt/lists/*

########################################################
# Node.js + pnpm (npm ships with Node; apps pick packageManager in config)
# Versions stamped by sync from .nvmrc / .node-version / package.json engines.node /
# packageManager, or optional agent-runtime.config.json nodeVersion / pnpmVersion overrides.
########################################################
ARG NODE_VERSION=22.22.2
ARG PNPM_VERSION=10.33.2
RUN curl --retry 3 --retry-delay 5 -fsSL \
      "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    | tar -xJ -C /usr/local --strip-components=1 \
  && corepack enable \
  && corepack prepare "pnpm@${PNPM_VERSION}" --activate

########################################################
# Docker (nested containers in Cloud Agent VMs)
# https://cursor.com/docs/cloud-agent/setup#running-docker
########################################################
RUN install -m 0755 -d /etc/apt/keyrings \
  && curl --retry 3 --retry-delay 5 -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
  && chmod a+r /etc/apt/keyrings/docker.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null \
  && apt-get update \
  && apt-get install -y \
    docker-ce=5:28.5.2-1~ubuntu.24.04~noble \
    docker-ce-cli=5:28.5.2-1~ubuntu.24.04~noble \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/docker \
  && printf '%s\n' '{' \
    '  "storage-driver": "fuse-overlayfs",' \
    '  "features": { "containerd-snapshotter": false }' \
    '}' > /etc/docker/daemon.json \
  && update-alternatives --set iptables /usr/sbin/iptables-legacy \
  && update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy

########################################################
# Supabase CLI — pinned GitHub release (not installed at agent start)
# https://github.com/supabase/cli/releases
########################################################
RUN curl --retry 3 --retry-delay 5 -fsSL \
      "https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}/supabase_${SUPABASE_CLI_VERSION}_linux_amd64.tar.gz" \
    | tar -xz -C /usr/local/bin supabase

########################################################
# ubuntu user (Cloud Agent runtime user)
########################################################
RUN id -u ubuntu &>/dev/null || useradd -m -s /bin/bash ubuntu \
  && groupadd -f docker \
  && usermod -aG docker ubuntu \
  && usermod -aG sudo ubuntu \
  && echo "ubuntu ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ubuntu

USER ubuntu
WORKDIR /home/ubuntu
