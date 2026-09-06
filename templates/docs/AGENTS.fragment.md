# Cursor Cloud (fragment)

```bash
pnpm add github:tomKrueger/agent-runtime-kit#v0.1.0
pnpm exec agent-runtime init
```

Edit `.cursor/agent-runtime.config.json` (ports, `migrateCmd`, `envKeys` / `envDefaults`).

```json
"install": "pnpm install --frozen-lockfile && pnpm exec agent-runtime cursor-install",
"start": "pnpm exec agent-runtime cursor-start"
```

**Local vs hosted:** if `NEXT_PUBLIC_SUPABASE_URL` is not loopback, local Docker/Supabase is skipped. Put hosted credentials in Cursor Secrets.

Only remove legacy `.cursor/scripts/cursor-agent/` after a successful Cloud Build + boot on ≥ v0.1.0.
