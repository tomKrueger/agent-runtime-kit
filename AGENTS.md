# AGENTS.md — working on agent-runtime-kit

## Read first

1. [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) — goals, FRs, roadmap, acceptance criteria  
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — components and data flow  
3. [docs/CONSUMER_MIGRATION.md](docs/CONSUMER_MIGRATION.md) — how apps adopt the kit  

## Hard rules

- Never casually overwrite consumer `agent-runtime.config.json` from `init --force` (use `--force-config` only when explicit).
- Do not hardcode Supabase ports `54321` as universal; derive from config.
- Do not commit real Preview/Prod secrets.
- Prefer GitHub tag releases; bump version + tag when shipping consumer-visible behavior.
- Cursor `environment.json` is an adapter output of `sync`, not the home for migrate/envKeys.

## Verify locally

```bash
node --test src/**/*.test.js src/core/*.test.js
node bin/agent-runtime.js help
```

## This is NOT the Next.js you know

If editing consumer apps that use Next.js, read that app’s `node_modules/next/dist/docs/` before relying on training-data APIs. This kit itself is plain Node ESM + bash.
