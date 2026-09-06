# Cursor Cloud (fragment)

Cloud Agents must use the committed `.cursor/environment.json`. Install the shared kit:

```bash
pnpm add github:tomKrueger/agent-runtime-kit#v0.0.2
pnpm exec agent-runtime init
```

Then set `install` / `start` to `pnpm exec agent-runtime cursor-install` and `cursor-start` (see package templates). Configure ports and migrate via `.cursor/agent-runtime.config.json`.

**Local vs hosted:** if `NEXT_PUBLIC_SUPABASE_URL` is not loopback, local Docker/Supabase is skipped. Put hosted credentials in Cursor Secrets.
