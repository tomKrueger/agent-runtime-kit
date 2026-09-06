import { join } from "node:path";
import { loadProjectConfig } from "../core/config.js";
import { applyResolvedEnv, resolveEnvMap, writeEnvLocal } from "../core/env.js";
import { runBashScript, runMigrate, SCRIPTS_DIR } from "../core/run.js";
import { isLocalSupabaseUrl } from "../core/supabase.js";

/**
 * Cursor Cloud boot entrypoint (also usable as `prepare`).
 *
 * Always writes .env.local from Secrets + config defaults.
 * Starts local Supabase + migrate only when NEXT_PUBLIC_SUPABASE_URL is loopback.
 * Resilient by default (exit 0) so a missing datastore never bricks the agent.
 *
 * @param {string[]} _args
 * @param {{ projectRoot?: string, resilient?: boolean }} [opts]
 */
export async function cmdCursorStart(_args = [], opts = {}) {
  const projectRoot = opts.projectRoot || process.cwd();
  const config = loadProjectConfig(projectRoot);
  const resilient = opts.resilient ?? config.cursorStart?.resilient !== false;

  const finish = (code) => {
    if (resilient) {
      if (code !== 0) {
        console.warn(`[agent-runtime cursor-start] continuing with exit 0 (resilient); underlying code=${code}`);
      }
      process.exitCode = 0;
      return;
    }
    process.exitCode = code;
  };

  try {
    console.log(`[agent-runtime cursor-start] project=${projectRoot}`);

    const values = resolveEnvMap(config);
    const envPath = writeEnvLocal(projectRoot, values, {
      generatorLabel: "agent-runtime cursor-start",
    });
    applyResolvedEnv(values);
    const dbHost = (values.DATABASE_URL || "").match(/@([^/:]+)[:/]/)?.[1] || "?";
    console.log(`[agent-runtime cursor-start] wrote ${envPath} (DATABASE_URL host: ${dbHost})`);

    const supabaseUrl = values.NEXT_PUBLIC_SUPABASE_URL || "";
    const local = isLocalSupabaseUrl(supabaseUrl);
    console.log(
      `[agent-runtime cursor-start] NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl} local=${local}`,
    );

    const childEnv = {
      ...process.env,
      ...values,
      AGENT_RUNTIME_PROJECT_ROOT: projectRoot,
    };

    if (!local) {
      console.log("[agent-runtime cursor-start] hosted Supabase configured; skipping local stack and local migrations");
      if (isLocalSupabaseUrl(values.DATABASE_URL || "") || /@127\.0\.0\.1[:/]|@localhost[:/]/.test(values.DATABASE_URL || "")) {
        console.warn(
          "[agent-runtime cursor-start] WARN: NEXT_PUBLIC_SUPABASE_URL is hosted but DATABASE_URL still looks local — set DATABASE_URL (and keys) via Cursor Secrets",
        );
      }
      console.log("[agent-runtime cursor-start] done");
      finish(0);
      return;
    }

    const start = runBashScript(join(SCRIPTS_DIR, "start-local-supabase.sh"), {
      cwd: projectRoot,
      env: childEnv,
    });
    if (start.status !== 0) {
      console.warn("[agent-runtime cursor-start] WARN: local Supabase did not start; database may be unavailable");
      finish(start.status || 1);
      return;
    }

    if (config.migrateCmd) {
      console.log(`==> migrate: ${config.migrateCmd}`);
      const mig = runMigrate(config.migrateCmd, { cwd: projectRoot, env: childEnv });
      if (mig.status !== 0) {
        console.warn("[agent-runtime cursor-start] WARN: migrations failed");
        finish(mig.status || 1);
        return;
      }
    } else {
      console.log("[agent-runtime cursor-start] no migrateCmd configured; skip migrations");
    }

    console.log("[agent-runtime cursor-start] done");
    finish(0);
  } catch (err) {
    console.error(`[agent-runtime cursor-start] ERROR: ${err instanceof Error ? err.message : err}`);
    finish(1);
  }
}

/** Alias for non-Cursor adapters / manual boots. */
export async function cmdPrepare(args, opts) {
  return cmdCursorStart(args, opts);
}
