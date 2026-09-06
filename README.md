# @gritgoattech/agent-runtime-kit

Shared **workspace runtime** for Cursor Cloud Agents, OpenAI Codex, Claude Code, and self-hosted runners — especially **local vs hosted Supabase**.

> **Phase 0:** package scaffold + `init` / `version` / `help` only. Core prepare and vendor adapters land in later phases.

## Install (GitHub only — no npm registry / no extra server)

```bash
pnpm add github:GritGoatTech/agent-runtime-kit#v0.0.1
# or
npm install github:GritGoatTech/agent-runtime-kit#v0.0.1
```

Private repo: Cloud Agents / CI need a GitHub token with `contents:read` (e.g. Cursor Secret) so the package can be fetched.

## CLI

```bash
pnpm exec agent-runtime help
pnpm exec agent-runtime version
pnpm exec agent-runtime init          # writes .cursor/agent-runtime.config.json + environment.json example
pnpm exec agent-runtime init --force  # overwrite scaffolds
```

## Project config

After `init`, edit `.cursor/agent-runtime.config.json`:

- `packageManager` / `installCmd` / `devCmd` / `migrateCmd`
- `supabase.apiPort` / `dbPort` / `studioPort` (e.g. Hresale `603xx`, GritGoat `543xx`)
- `envDefaults` / `envKeys` for `.env.local` generation (phase 1+)

## Roadmap

| Phase | Contents |
| --- | --- |
| **0 (this)** | Package, bin, `init`, templates, GitHub tag install |
| 1 | Core: setup-env, local/hosted Supabase, migrate |
| 2 | Cursor `cursor-install` / `cursor-start` + migrate Hresale |
| 3 | GritGoat config parity |
| 4 | GHCR worker base image |
| 5 | Self-hosted adapters (Cursor / Claude / generic) |
| 6 | Codex + Claude managed (hosted-first) |

## License

UNLICENSED — private GritGoatTech package.
