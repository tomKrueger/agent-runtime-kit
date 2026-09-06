# Agent Runtime Kit — Requirements & Intent

**Audience:** Engineers and coding agents continuing work on this repository  
**Package:** `@tomkrueger/agent-runtime-kit`  
**Repo:** https://github.com/tomKrueger/agent-runtime-kit  

**Current release:** `v0.1.1`  
**Status:** Cursor path is usable; Claude/Codex/self-hosted adapters are partial

This document is the source of truth for *why* the kit exists and *what* it must do. Prefer this over chat history when picking up work.

---

## 1. Problem

Two product apps (and more later) need the same Cloud Agent / self-hosted bootstrap story:

| App | Stack notes |
| --- | --- |
| **HresaleHub** | Next.js, pnpm, Drizzle, local Supabase on **non-default ports** `60321` / `60322` / `60323` |
| **GritGoat** | Next.js, npm, Prisma, local Supabase on default ports `54321` / `54322` / `54323` |

Each previously (or still) maintained nearly identical bash under `.cursor/scripts/cursor-agent/`:

- Ensure Docker + Supabase CLI
- Warm Supabase images on Build
- Write `.env.local` from Cursor Secrets + local defaults
- Start local Supabase **only** when URL is loopback; skip when hosted Preview/Prod
- Run project-specific migrate command

Copy-paste drift is unacceptable. The kit must be one npm-installable package (hosted on GitHub tags, no separate registry server required).

---

## 2. Goals (desired outcomes)

1. **One shared runtime** for “make this repo ready to run” across:
   - Cursor Cloud Agents (managed)
   - Cursor Self-Hosted Machines (future / image reuse)
   - Claude Code cloud + self-hosted runners (adapters)
   - OpenAI Codex Cloud (adapters, hosted-first if DinD is weak)
   - Generic self-hosted runners we operate
2. **Per-project config** drives ports, migrate command, env keys/defaults, package manager — **never** hardcode `54321` as universal.
3. **Local vs hosted Supabase** is first-class: Secrets can point at hosted Preview without starting Docker.
4. **Thin vendor adapters**: Cursor’s `.cursor/environment.json` is generated/synced from config; product settings do not live only inside Cursor-specific files.
5. **Safe scaffolding**: `init --force` must **not** wipe project config; regenerating adapters is separate from replacing config.
6. **Consumers can delete legacy bash** only after a tagged release proves parity on a real Cloud Build + boot.

Non-goals (for now):

- Publishing a GHCR prebuilt image (shared Dockerfile in-kit first; registry image later)
- Putting secrets in the package or in committed config beyond local demo defaults
- Perfect DinD on every managed vendor on day one (Codex/Claude managed may stay hosted-first)

---

## 3. Design principles

### 3.1 Two layers

| Layer | What | Examples |
| --- | --- | --- |
| **Shared config** | Vendor-neutral source of truth | `agent-runtime.config.json` (+ optional overlays) |
| **Vendor adapters** | How that vendor invokes the kit | `.cursor/environment.json`, Claude bootstrap fragment, future Codex setup |

Cursor’s `environment.json` schema is closed (`unevaluatedProperties: false`). You **cannot** put `migrateCmd` / `envKeys` there. Therefore:

- Runtime behavior reads **root config** (+ overlay)
- `sync` writes the thin Cursor file (name, ports list, install/start strings)

### 3.2 Config location and overlays

**Required (repo root, next to `package.json`):**

```text
agent-runtime.config.json
```

**Optional overlays (deep-merge on top of base):**

```text
agent-runtime.config.cursor.json
agent-runtime.config.claude.json
# future: agent-runtime.config.codex.json
```

Merge rules:

- Nested objects: deep-merge
- Arrays and scalars in overlay: **replace**

Vendor selection:

- `cursor-install` / `cursor-start` → merge with `cursor` overlay
- `prepare --vendor=claude` or `AGENT_RUNTIME_VENDOR=claude` → Claude overlay
- `prepare` with `default` → base only

**Legacy:** `.cursor/agent-runtime.config.json` still loads with a warning; `sync` can move it to root. Do not put new shared config under `.cursor/`.

### 3.3 Init / sync safety (hard requirement)

| Command / flag | Allowed to change |
| --- | --- |
| `init` | Create base config **only if missing**; create adapter if missing. **Does not** write vendor overlays or example overlay files |
| `overlay <vendor>` | Create `agent-runtime.config.<vendor>.json` from template **only if missing** (`--force` replaces with `.bak`) |
| `init --refresh` / `init --force` | Regenerate adapters from config — **never overwrite base config** |
| `init --force-config` | Replace base config from template (write `.bak`) — rare, explicit |
| `sync` | Regenerate adapters only — **never touch base/overlay config content**. Writes `.cursor/environment.json` and the shared `.cursor/Dockerfile` from the kit template |

Rationale: config holds product-specific ports, secrets defaults, migrate commands. Wiping it on “force” destroyed Hresale’s `603xx` settings in early trials. Vendor overlays stay opt-in so `init` does not litter example Cursor/Claude files into every consumer.

### 3.4 Environment resolution

For each key written to `.env.local`:

1. `process.env` (Cursor/Codex/Claude Secrets)
2. Merged `envDefaults` from config
3. Built-in locals derived from `supabase.apiPort` / `dbPort` (demo anon/service JWTs + loopback URLs)

Local vs hosted:

- If resolved `NEXT_PUBLIC_SUPABASE_URL` host is `127.0.0.1` or `localhost` → start local Supabase + run `migrateCmd`
- Else → skip local stack and local migrations; **warn** if `DATABASE_URL` still looks loopback while Supabase URL is hosted

### 3.5 Cursor Build vs boot

| Phase | Command | Responsibility |
| --- | --- | --- |
| Build (`install`) | `cursor-install` | Ensure Docker + pinned Supabase CLI; warm images (`supabase start` then `stop`). **Do not** re-run `pnpm install` by default — `environment.json` already runs install before the CLI |
| Boot (`start`) | `cursor-start` | Write `.env.local`; local/hosted branch; migrate. **Resilient** by default (exit 0) so a dead DB does not brick the agent |

---

## 4. Functional requirements

### FR-1 — Installable from GitHub

- Consumers pin: `github:tomKrueger/agent-runtime-kit#vX.Y.Z` (or org transfer later)
- No mandatory npmjs or custom registry
- Private repo: document that Cloud Agents need a GitHub token with `contents:read`

### FR-2 — Project config schema

Base config **must** include:

- `supabase.apiPort`, `supabase.dbPort` (integers)
- Optional: `supabase.studioPort`, `environmentName`, `packageManager`, `installCmd`, `devCmd`, `migrateCmd`, `envDefaults`, `envKeys`, `cursorInstall`, `cursorStart`

`environmentName` is the Cursor Cloud **display label** (e.g. `hresalehub-dev`), not the npm package name (`hresalehub_web_nextjs`). `init` may derive a default from `package.json` by stripping `_web_nextjs` etc.

### FR-3 — Cursor parity with Hresale bash

Behavior equivalent to Hresale’s `.cursor/scripts/cursor-agent/`:

- `ensure-supabase-runtime.sh`
- `warm` images on install
- `setup-env` → `.env.local`
- `start-local-supabase` with hosted skip
- `migrateCmd` (e.g. `pnpm db:migrate:local`)

### FR-4 — Sync regenerates Cursor adapter

`agent-runtime sync --vendor=cursor` writes `.cursor/environment.json`:

- `name` ← `environmentName`
- `ports` ← supabase ports (+ web 3000)
- `install` / `start` ← from `installCmd` + package manager + `agent-runtime cursor-*`
- `terminals[0].command` ← `devCmd`
- Preserve existing `build` / `user` / unrelated fields when possible

### FR-5 — Multi-app ports

Hresale `603xx` and GritGoat `543xx` must both work via config alone. Unit tests must assert port-derived URLs are not hardcoded to `54321`.

### FR-6 — Consumer migration gate

Document when it is safe to delete `.cursor/scripts/cursor-agent/*.sh`:

1. Pin ≥ `v0.1.0` (prefer latest)
2. Root config + overlays committed
3. `sync` committed so `environment.json` matches
4. Successful Cursor Cloud **Build** + agent boot
5. Then remove legacy bash

---

## 5. Non-functional requirements

- Node ≥ 20; plain ESM OK (no mandatory build step for git installs)
- Shell helpers for DinD/Supabase may live in `scripts/` and be invoked from Node
- Pin Supabase CLI version in ensure script (currently `2.114.0` — bump deliberately)
- Tests via `node --test` for config merge, env resolution, local URL detection
- README stays short; this file holds full intent

---

## 6. Reference consumers

### HresaleHub (primary migration target)

- Branch used for trial: `feat/agent-runtime-kit`
- Config: root `agent-runtime.config.json` with `60321/60322/60323`, session/bootstrap env keys, `migrateCmd: pnpm db:migrate:local`
- Overlay: `agent-runtime.config.cursor.json` for `cursorInstall` / `cursorStart`
- Legacy bash under `.cursor/scripts/cursor-agent/` kept until Cloud Build proves kit path

### GritGoat

- Not fully migrated yet
- Expect default ports `543xx`, `npm`, Prisma migrate command in config when adopted

---

## 7. Roadmap (phased)

| Phase | Status | Scope |
| --- | --- | --- |
| 0 | Done (`v0.0.x`) | Package scaffold, `init`/`version`/`help` |
| 1 | Done (`v0.1.0`) | Real `cursor-install` / `cursor-start`, config-driven env/ports |
| 1b | Done (`v0.1.1`) | Root config, vendor overlays, safe `sync`, `init` does not wipe config |
| 2 | Next | Harden Hresale migration docs; optional remove-bash checklist automation; ensure `sync` is idempotent and well-tested |
| 3 | Next | GritGoat consumer config + Cursor wiring |
| 4 | Next | Shared Cursor Dockerfile via `sync` (done in-kit); later GHCR worker base image (`FROM` for self-hosted) |
| 5 | Later | Claude self-hosted hook/wrapper first-class (`claude-bootstrap`); expand beyond `.agent-runtime/CLAUDE.bootstrap.md` |
| 6 | Later | Codex `codex-setup` (hosted-first Supabase) |
| 7 | Later | Generic `selfhosted-prepare` entrypoint for our runner fleet |

---

## 8. Acceptance criteria for “Cursor path complete”

- [ ] Pin `#v0.1.1` (or newer) in a consumer
- [ ] Root `agent-runtime.config.json` with that app’s real ports
- [ ] `pnpm exec agent-runtime sync` produces correct `.cursor/environment.json`
- [ ] `init --force` does **not** reset ports/envKeys in config
- [ ] Cloud Build runs `cursor-install` (ensure + warm) without failing the Build
- [ ] Agent boot runs `cursor-start`: `.env.local` written; local Supabase + migrate on loopback; skip on hosted URL
- [ ] Unit tests cover merge + 603xx-style ports
- [ ] Legacy bash can be deleted without breaking Cloud Agents

---

## 9. Explicit desires from product owners (Tom / team)

1. **Same pattern for Hresale and GritGoat** — both local Supabase vs hosted via Secrets.
2. **npm/git package**, not a second copy of scripts per repo.
3. **Config at repo root** beside `package.json`, not buried only under `.cursor/`.
4. **Vendor overrides** (`*.cursor.json`, `*.claude.json`) without forking the whole config.
5. **Change config → sync adapters**; do not require hand-editing `environment.json` ports forever.
6. **Never casually destroy config** with force flags meant only to refresh generated files.
7. **Eventually** one kit works for Cursor, Claude, OpenAI, and our self-hosted runners (core + adapters), with honesty that DinD is strongest on Cursor/self-hosted today.

---

## 10. Working on this repo (for agents)

```bash
git clone git@github.com:tomKrueger/agent-runtime-kit.git
cd agent-runtime-kit
node --test src/**/*.test.js src/core/*.test.js
node bin/agent-runtime.js help
```

Release practice:

1. Bump `package.json` version
2. Update README pin examples
3. Commit on `main`
4. Tag `vX.Y.Z` and push tag (consumers pin the tag)
5. Bump consumer apps deliberately

Do **not** put real Preview/Prod secrets in this repository. Local demo JWT keys for `supabase start` are public by design.

---

## 11. Related docs in-repo

- [README.md](../README.md) — quick start
- [ARCHITECTURE.md](./ARCHITECTURE.md) — component map and data flow
- [CONSUMER_MIGRATION.md](./CONSUMER_MIGRATION.md) — how an app switches from bash to the kit
- [templates/docs/AGENTS.fragment.md](../templates/docs/AGENTS.fragment.md) — snippet for consumer `AGENTS.md`
