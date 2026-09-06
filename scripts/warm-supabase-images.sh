#!/usr/bin/env bash
# Warm local Supabase images into the Build snapshot (start then stop).
set -euo pipefail

PROJECT_ROOT="${AGENT_RUNTIME_PROJECT_ROOT:-$(pwd)}"
cd "$PROJECT_ROOT"

log() { echo "[warm-supabase] $*"; }

if ! command -v supabase >/dev/null 2>&1 || ! command -v dockerd >/dev/null 2>&1; then
  log "supabase CLI or dockerd missing; skip warm"
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  log "starting Docker daemon for image warm"
  sudo dockerd >/tmp/dockerd-install.log 2>&1 &
  for _ in $(seq 1 60); do
    if sudo docker info >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

if docker info >/dev/null 2>&1 || sudo docker info >/dev/null 2>&1; then
  log "warming local Supabase Docker images"
  supabase start
  supabase stop
else
  log "warning: Docker did not start; skipping image warm (see /tmp/dockerd-install.log)"
fi
