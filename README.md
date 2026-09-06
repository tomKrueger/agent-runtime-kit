# @gritgoattech/agent-runtime-kit

Shared workspace runtime for Cursor / Claude / Codex / self-hosted runners.

## Config layout (repo root)

```text
agent-runtime.config.json                 # required — shared defaults
agent-runtime.config.cursor.json          # optional — Cursor overrides
agent-runtime.config.claude.json          # optional — Claude overrides
.cursor/environment.json                  # GENERATED for Cursor — do not hand-edit ports/name/install
```

Merge order: **base → vendor overlay**. Arrays/scalars in the overlay replace; nested objects deep-merge.

Cursor cannot read our config file (its schema is closed). So `environment.json` stays a thin adapter. After you change ports / `environmentName` / install commands in config:

```bash
pnpm exec agent-runtime sync
# or: pnpm exec agent-runtime init --refresh
```

That regenerates `.cursor/environment.json` from the merged Cursor config. It **never** deletes or rewrites `agent-runtime.config.json`.

## Init safety

| Flag | Effect |
| --- | --- |
| `init` | Create base config **only if missing**; create `environment.json` if missing |
| `init --refresh` / `init --force` | Refresh adapters from config — **config kept** |
| `init --force-config` | Overwrite base config from template (backup `.bak`) — rare |

## Commands

```bash
pnpm add github:tomKrueger/agent-runtime-kit#v0.1.1
pnpm exec agent-runtime init
pnpm exec agent-runtime sync --vendor=cursor
pnpm exec agent-runtime sync --vendor=claude   # writes .agent-runtime/CLAUDE.bootstrap.md
```

Cursor Cloud:

```json
"install": "pnpm install --frozen-lockfile && pnpm exec agent-runtime cursor-install",
"start": "pnpm exec agent-runtime cursor-start"
```

(Those strings are written by `sync` from `installCmd` / packageManager.)

Claude / generic:

```bash
pnpm exec agent-runtime prepare --vendor=claude
```

## Env resolution

process env (Secrets) → merged `envDefaults` → port-derived local defaults.

## License

UNLICENSED — `@gritgoattech/agent-runtime-kit`.
