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
src/commands/sync.js          Regenerate vendor adapters
src/commands/cursor-install.js
src/commands/cursor-start.js  (+ prepare)
scripts/*.sh                  DinD / supabase CLI helpers
templates/                    Examples + Cursor environment template
```

## Data flow (Cursor Cloud)

```text
Cursor Build
  └─ environment.json "install"
       └─ pnpm install && agent-runtime cursor-install
            ├─ load agent-runtime.config.json ⊕ .cursor.json
            ├─ scripts/ensure-supabase-runtime.sh
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

## Why environment.json is generated

Cursor reads **only** `.cursor/environment.json` for Cloud Agent install/start/ports. That schema rejects unknown fields. Shared product settings therefore live in root config; `sync` projects the subset Cursor needs into `environment.json`.

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
