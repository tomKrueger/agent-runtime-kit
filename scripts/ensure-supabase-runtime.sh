#!/usr/bin/env bash
# Idempotent: install Docker Engine + Supabase CLI when missing.
# Prefer baking these into the consumer .cursor/Dockerfile so this is a no-op.
set -euo pipefail

SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.114.0}"

if command -v supabase >/dev/null 2>&1 && command -v dockerd >/dev/null 2>&1; then
  echo "[ensure-supabase-runtime] supabase CLI and Docker already present"
  supabase --version || true
  docker --version || true
  exit 0
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "[ensure-supabase-runtime] sudo is required to install Docker/Supabase CLI" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

if ! command -v dockerd >/dev/null 2>&1; then
  echo "[ensure-supabase-runtime] installing Docker Engine + fuse-overlayfs"
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends ca-certificates curl gnupg fuse-overlayfs iptables
  sudo install -m 0755 -d /etc/apt/keyrings
  curl --retry 3 --retry-delay 5 -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y \
    docker-ce=5:28.5.2-1~ubuntu.24.04~noble \
    docker-ce-cli=5:28.5.2-1~ubuntu.24.04~noble \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin
  sudo mkdir -p /etc/docker
  printf '%s\n' '{' '  "storage-driver": "fuse-overlayfs",' '  "features": { "containerd-snapshotter": false }' '}' | sudo tee /etc/docker/daemon.json >/dev/null
  sudo update-alternatives --set iptables /usr/sbin/iptables-legacy || true
  sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy || true
  sudo groupadd -f docker
  sudo usermod -aG docker "$(id -un)" || true
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "[ensure-supabase-runtime] installing Supabase CLI v${SUPABASE_CLI_VERSION}"
  tmp="$(mktemp -d)"
  curl -fsSL "https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}/supabase_${SUPABASE_CLI_VERSION}_linux_amd64.tar.gz" \
    -o "${tmp}/supabase.tar.gz"
  tar -xzf "${tmp}/supabase.tar.gz" -C "${tmp}"
  sudo install -m 0755 "${tmp}/supabase" /usr/local/bin/supabase
  rm -rf "${tmp}"
fi

echo "[ensure-supabase-runtime] done"
supabase --version
docker --version || true
