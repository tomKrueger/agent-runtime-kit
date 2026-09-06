# @gritgoattech/agent-runtime-kit

Shared workspace runtime for Cursor / Claude / Codex / self-hosted runners: local vs hosted Supabase, `.env.local` generation, migrate, Build-time image warm.

## Documentation (start here)

| Doc | Purpose |
| --- | --- |
| **[docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)** | Full requirements, desires, roadmap, acceptance criteria — **handoff for other agents** |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Component map and Cursor data flow |
| [docs/CONSUMER_MIGRATION.md](docs/CONSUMER_MIGRATION.md) | How apps migrate off bash scripts |
| [AGENTS.md](AGENTS.md) | Rules for agents working *in this repo* |

## Quick start (consumers)

```bash
pnpm add github:tomKrueger/agent-runtime-kit#v0.1.1
# write agent-runtime.config.json at repo root (ports, migrateCmd, envKeys)
pnpm exec agent-runtime sync
```

## Config layout (repo root)

```text
agent-runtime.config.json                 # required — shared defaults
agent-runtime.config.cursor.json          # optional — Cursor overrides
agent-runtime.config.claude.json          # optional — Claude overrides
.cursor/environment.json                  # GENERATED for Cursor — refresh via sync
```

Merge order: **base → vendor overlay**. After editing config:

```bash
pnpm exec agent-runtime sync
```

## Init safety

| Flag | Effect |
| --- | --- |
| `init` | Create base config **only if missing** |
| `init --refresh` / `init --force` | Refresh adapters — **config kept** |
| `init --force-config` | Replace base config from template (writes `.bak`) |

## Commands

- `cursor-install` — Cloud Build: ensure Docker/CLI + warm Supabase images  
- `cursor-start` / `prepare` — boot: `.env.local`, local/hosted Supabase, migrate  
- `sync` — regenerate vendor adapters from config  

## Env resolution

process env (Secrets) → merged `envDefaults` → port-derived local defaults.

## License

UNLICENSED — `@gritgoattech/agent-runtime-kit`.
