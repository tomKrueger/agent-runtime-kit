# Architecture

## Components

```text
bin/agent-runtime.js          CLI entry
src/cli.js                    Command router
src/core/config.js            Load/merge/normalize config
src/core/env.js               Resolve + write .env.local
src/core/supabase.js          Local URL detection
src/core/run.js               Spawn bash / migrate
src/commands/init.js          Safe scaffold
src/commands/overlay.js       Opt-in vendor overlay files
src/commands/sync.js          Regenerate vendor adapters (+ Dockerfile)
src/commands/cursor-install.js
src/commands/cursor-start.js  (+ prepare)
scripts/*.sh                  DinD / supabase CLI helpers
templates/                    Config examples + Cursor Dockerfile / environment
```

## Data flow (Cursor Cloud)

```text
Cursor image build
  └─ .cursor/environment.json "build"
       └─ .cursor/Dockerfile   ← copied from kit by `agent-runtime sync`
            (Ubuntu, Node, Docker DinD, pinned Supabase CLI)

Cursor Build (install)
  └─ environment.json "install"
       └─ pnpm install && agent-runtime cursor-install
            ├─ load agent-runtime.config.json ⊕ .cursor.json
            ├─ scripts/ensure-supabase-runtime.sh   (usually no-op if Dockerfile baked tools)
            └─ scripts/warm-supabase-images.sh

Cursor Boot
  └─ environment.json "start"
       └─ agent-runtime cursor-start
            ├─ load config ⊕ cursor overlay
            ├─ resolve env → write .env.local
            ├─ if local URL → start-local-supabase.sh → migrateCmd
            └─ if hosted URL → skip stack (warn if DATABASE_URL still local)
```

## Config merge

```text
agent-runtime.config.json
        │
        ▼
 optional agent-runtime.config.<vendor>.json
        │
        ▼
 normalize → AgentRuntimeConfig
```

## Why environment.json and Dockerfile are generated

Cursor reads **only** `.cursor/environment.json` for Cloud Agent install/start/ports, and builds from `.cursor/Dockerfile`. Shared product settings live in root config; `sync` projects the subset Cursor needs into those adapter files so apps do not each maintain a forked image definition.

## Self-hosted / Claude / Codex (target)

Same `prepare` core; different invocation:

| Vendor | Invocation |
| --- | --- |
| Cursor managed | `environment.json` → cursor-install / cursor-start |
| Cursor self-hosted | Worker image + same CLI (future GHCR base) |
| Claude | Hook/wrapper → `prepare --vendor=claude` |
| Codex | Setup script → `prepare --vendor=codex` (hosted-first) |
| Our runners | Entrypoint → `selfhosted-prepare` |

See [REQUIREMENTS.md](./REQUIREMENTS.md) for goals and acceptance criteria.
