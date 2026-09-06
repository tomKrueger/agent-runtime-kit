# @gritgoattech/agent-runtime-kit

Shared **workspace runtime** for Cursor Cloud Agents (and later Codex / Claude / self-hosted runners): **local vs hosted Supabase**, `.env.local` generation, migrate, and Build-time image warm.

## Install (GitHub only — no separate registry)

```bash
pnpm add github:tomKrueger/agent-runtime-kit#v0.1.0
pnpm exec agent-runtime init   # first time only
```

Private repo: Cloud Agents need a GitHub token with `contents:read` so the dependency can be fetched.

## Consumer contract

### 1. `.cursor/agent-runtime.config.json` (required)

| Field | Required | Purpose |
| --- | --- | --- |
| `supabase.apiPort` / `dbPort` | **yes** | Drives default `NEXT_PUBLIC_SUPABASE_URL` + `DATABASE_URL` (no hardcoded 54321) |
| `supabase.studioPort` | no | Used when scaffolding `environment.json` ports |
| `migrateCmd` | recommended | e.g. `pnpm db:migrate:local` — run on local boot only |
| `envDefaults` | recommended | Fallbacks when Cursor Secrets unset (`SESSION_SECRET`, bootstrap admin, …) |
| `envKeys` | recommended | Ordered keys written to `.env.local` |
| `environmentName` | no | Becomes `environment.json` `"name"` (display label) |
| `packageManager` / `installCmd` / `devCmd` | no | Used by `init` when writing `environment.json` |
| `cursorInstall.runInstallCmd` | no | Default `false` — deps come from `environment.json` `pnpm install && …` |
| `cursorInstall.ensureRuntime` / `warmSupabaseImages` | no | Default `true` |
| `cursorStart.resilient` | no | Default `true` (always exit 0 on boot) |

**Resolution order for each env key:** process env (Cursor Secrets) → `envDefaults` → port-derived local defaults (demo JWT keys + URLs).

### 2. `.cursor/environment.json` (thin wiring)

```json
{
  "name": "hresalehub-dev",
  "install": "pnpm install --frozen-lockfile && pnpm exec agent-runtime cursor-install",
  "start": "pnpm exec agent-runtime cursor-start"
}
```

Keep ports listed for the dashboard; they should match `supabase.*` in project config.

### 3. When to delete legacy bash scripts

Safe to remove `.cursor/scripts/cursor-agent/*.sh` only after:

1. Pinning a release ≥ `v0.1.0`
2. Committing a correct `agent-runtime.config.json` (ports + env keys)
3. Pointing `install` / `start` at the CLI
4. Completing a successful Cursor Cloud **Build** + agent boot that writes `.env.local` and reaches Postgres

Until then, keep the bash scripts as a rollback.

## Commands

| Command | When | Behavior |
| --- | --- | --- |
| `cursor-install` | Cloud **Build** | Ensure Docker + Supabase CLI; warm `supabase start`/`stop` (does not re-install node deps by default) |
| `cursor-start` / `prepare` | Every boot | Write `.env.local` → if URL is loopback, start local Supabase + `migrateCmd`; if hosted, skip |

## Local vs hosted

If resolved `NEXT_PUBLIC_SUPABASE_URL` host is `127.0.0.1` or `localhost` → local stack.  
Otherwise (Preview/Prod project URL) → skip Docker/Supabase/migrate.

## Example (HresaleHub)

```json
{
  "environmentName": "hresalehub-dev",
  "packageManager": "pnpm",
  "migrateCmd": "pnpm db:migrate:local",
  "supabase": { "apiPort": 60321, "dbPort": 60322, "studioPort": 60323 },
  "envDefaults": {
    "SESSION_SECRET": "cloud_dev_local_session_secret_change_me_0123456789abcdef",
    "BOOTSTRAP_ADMIN_EMAIL": "owner@example.com",
    "BOOTSTRAP_ADMIN_PASSWORD": "temporary-password-123"
  },
  "envKeys": [
    "DATABASE_URL",
    "SESSION_SECRET",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "BOOTSTRAP_ADMIN_EMAIL",
    "BOOTSTRAP_ADMIN_PASSWORD"
  ]
}
```

## License

UNLICENSED — private package (`@gritgoattech/agent-runtime-kit`).
