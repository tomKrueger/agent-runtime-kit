# Agent runtime (consumer fragment)

Shared kit: `@gritgoattech/agent-runtime-kit` — see the kit repo docs:

- https://github.com/tomKrueger/agent-runtime-kit/blob/main/docs/REQUIREMENTS.md
- https://github.com/tomKrueger/agent-runtime-kit/blob/main/docs/CONSUMER_MIGRATION.md

```bash
pnpm add github:tomKrueger/agent-runtime-kit#v0.1.1
# maintain agent-runtime.config.json at repo root
pnpm exec agent-runtime sync
```

Cursor Cloud uses generated `.cursor/environment.json` (`cursor-install` / `cursor-start`).

**Local vs hosted:** if `NEXT_PUBLIC_SUPABASE_URL` is not loopback, local Docker/Supabase is skipped. Put hosted credentials in Cursor Secrets.

Only remove legacy `.cursor/scripts/cursor-agent/` after a successful Cloud Build + boot (see CONSUMER_MIGRATION.md).
