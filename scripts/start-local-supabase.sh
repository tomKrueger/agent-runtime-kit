#!/usr/bin/env bash
# Per-boot: start dockerd + local `supabase start` when NEXT_PUBLIC_SUPABASE_URL is loopback.
# Does not install the CLI or Docker — those belong in the image / cursor-install.
#
# Caller must export NEXT_PUBLIC_SUPABASE_URL (resolved by agent-runtime) before invoking.
set -euo pipefail

PROJECT_ROOT="${AGENT_RUNTIME_PROJECT_ROOT:-$(pwd)}"
cd "$PROJECT_ROOT"

log() { echo "[start-local-supabase] $*"; }

uses_local_supabase() {
  local url="${NEXT_PUBLIC_SUPABASE_URL:-}"
  if [[ -z "$url" ]]; then
    log "NEXT_PUBLIC_SUPABASE_URL unset; refusing to guess — set it via agent-runtime config/env" >&2
    return 1
  fi
  case "$url" in
    http://127.0.0.1:*|http://localhost:*|https://127.0.0.1:*|https://localhost:*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

docker_do() {
  if docker "$@" >/dev/null 2>&1; then return 0; fi
  if command -v sg >/dev/null 2>&1; then
    sg docker -c "docker $*" >/dev/null 2>&1 && return 0
  fi
  sudo docker "$@" >/dev/null 2>&1
}

start_dockerd() {
  if docker_do info; then
    log "Docker is already running"
    return 0
  fi
  if ! command -v dockerd >/dev/null 2>&1; then
    log "dockerd not found; CLI/Docker must be in the environment image or cursor-install" >&2
    return 1
  fi
  log "starting Docker daemon"
  sudo service docker start >/dev/null 2>&1 || (sudo dockerd >/tmp/dockerd.log 2>&1 &) || true
  for _ in $(seq 1 60); do
    if docker_do info; then
      sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
      log "Docker daemon is ready"
      return 0
    fi
    sleep 1
  done
  log "Docker failed to start; see /tmp/dockerd.log" >&2
  return 1
}

if ! uses_local_supabase; then
  log "hosted Supabase URL set; skipping local stack"
  exit 0
fi

if ! command -v supabase >/dev/null 2>&1; then
  log "supabase CLI is not installed (expected in the image / cursor-install)" >&2
  exit 1
fi

start_dockerd

if docker info >/dev/null 2>&1; then
  supabase start
else
  sudo supabase start
fi
