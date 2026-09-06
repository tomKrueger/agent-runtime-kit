# Consumer migration guide

How an app (e.g. HresaleHub, GritGoat) switches from vendored `.cursor/scripts/cursor-agent/*.sh` to this kit.

## Steps

1. **Add dependency** (pin a tag):

   ```bash
   pnpm add github:tomKrueger/agent-runtime-kit#v0.1.1
   ```

2. **Create root config** `agent-runtime.config.json` with that app’s real ports, `migrateCmd`, `envKeys`, `envDefaults`.  
   Optional: `agent-runtime.config.cursor.json` for Cursor-only toggles.

3. **Generate Cursor adapters**:

   ```bash
   pnpm exec agent-runtime sync
   ```

   Commit the config files plus generated `.cursor/environment.json` and `.cursor/Dockerfile`.

4. **Rebuild** the Cursor Cloud environment bound to `.cursor/environment.json` (Build).

5. **Verify boot**: agent start writes `.env.local`, reaches DB, migrations apply (local) or skip cleanly (hosted Secrets).

6. **Only then** delete `.cursor/scripts/cursor-agent/` and any docs that point only at those scripts.

## After changing ports or environmentName

```bash
# edit agent-runtime.config.json
pnpm exec agent-runtime sync
git add agent-runtime.config.json .cursor/environment.json .cursor/Dockerfile
```

Do **not** use `init --force-config` unless you intentionally want the template to replace your config (a `.bak` is written).

## Private GitHub dependency

Cloud Agents cloning a private kit repo need a secret token with `contents:read` so `pnpm install` can fetch `github:…/agent-runtime-kit#tag`.

## Rollback

Keep the old bash scripts in git history or on a branch until step 5 succeeds. Point `environment.json` `install`/`start` back at the bash paths if needed.
