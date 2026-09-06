# Agent runtime (consumer fragment)

Shared kit: `@tomkrueger/agent-runtime-kit` (Tom Krueger Agent Runtime Kit) — see the kit repo docs:

- https://github.com/tomKrueger/agent-runtime-kit/blob/main/docs/REQUIREMENTS.md
- https://github.com/tomKrueger/agent-runtime-kit/blob/main/docs/CONSUMER_MIGRATION.md

```bash
pnpm add github:tomKrueger/agent-runtime-kit#v0.1.1
# maintain agent-runtime.config.json at repo root
pnpm exec agent-runtime sync
```

Cursor Cloud uses generated `.cursor/environment.json` + `.cursor/Dockerfile` (`cursor-install` / `cursor-start`).

After Cloud Build / boot, support breadcrumbs land in:

- `.agent-runtime/install-support.md` (+ `.json`) — what the install phase did, tool versions, kit version, timestamp
- `.agent-runtime/start-support.md` (+ `.json`) — boot time, local vs hosted, migrate outcome, kit version

Add those to `.gitignore` if you do not want VM-local reports committed.

**Local vs hosted:** if `NEXT_PUBLIC_SUPABASE_URL` is not loopback, local Docker/Supabase is skipped. Put hosted credentials in Cursor Secrets.

Only remove legacy `.cursor/scripts/cursor-agent/` after a successful Cloud Build + boot (see CONSUMER_MIGRATION.md).
