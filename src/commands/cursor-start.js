import { join } from "node:path";
import { loadProjectConfig } from "../core/config.js";
import { applyResolvedEnv, resolveEnvMap, writeEnvLocal } from "../core/env.js";
import { runBashScript, runMigrate, SCRIPTS_DIR } from "../core/run.js";
import { isLocalSupabaseUrl } from "../core/supabase.js";
import {
  START_SUPPORT_BASENAME,
  buildStartSupportReport,
  writeSupportReport,
} from "../core/support-report.js";

/**
 * Cursor Cloud boot entrypoint (also usable as `prepare`).
 *
 * Always writes .env.local from Secrets + config defaults.
 * Starts local Supabase + migrate only when NEXT_PUBLIC_SUPABASE_URL is loopback.
 * Resilient by default (exit 0) so a missing datastore never bricks the agent.
 *
 * @param {string[]} _args
 * @param {{ projectRoot?: string, resilient?: boolean, vendor?: string }} [opts]
 */
export async function cmdCursorStart(_args = [], opts = {}) {
  const projectRoot = opts.projectRoot || process.cwd();
  const config = loadProjectConfig(projectRoot, { vendor: opts.vendor || "cursor" });
  const resilient = opts.resilient ?? config.cursorStart?.resilient !== false;

  /** @type {Record<string, unknown>} */
  const bootExtra = {
    notes: /** @type {string[]} */ ([]),
  };

  const finish = (code) => {
    try {
      const report = buildStartSupportReport(projectRoot, config, bootExtra);
      const paths = writeSupportReport(projectRoot, START_SUPPORT_BASENAME, report);
      console.log(`[agent-runtime cursor-start] support report: ${paths.mdPath}`);
    } catch (err) {
      console.warn(
        `[agent-runtime cursor-start] WARN: could not write support report: ${err instanceof Error ? err.message : err}`,
      );
    }
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
    bootExtra.envLocalPath = envPath;
    const dbHost = (values.DATABASE_URL || "").match(/@([^/:]+)[:/]/)?.[1] || "?";
    console.log(`[agent-runtime cursor-start] wrote ${envPath} (DATABASE_URL host: ${dbHost})`);

    const supabaseUrl = values.NEXT_PUBLIC_SUPABASE_URL || "";
    const local = isLocalSupabaseUrl(supabaseUrl);
    bootExtra.supabaseMode = local ? "local" : "hosted";
    try {
      bootExtra.supabaseUrlHost = new URL(supabaseUrl).host;
    } catch {
      bootExtra.supabaseUrlHost = supabaseUrl || null;
    }
    console.log(
      `[agent-runtime cursor-start] NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl} local=${local}`,
    );

    const childEnv = {
      ...process.env,
      ...values,
      AGENT_RUNTIME_PROJECT_ROOT: projectRoot,
    };

    if (!local) {
      console.log(
        "[agent-runtime cursor-start] hosted Supabase configured; skipping local stack and local migrations",
      );
      bootExtra.localSupabaseStarted = false;
      bootExtra.migrateRan = false;
      if (
        isLocalSupabaseUrl(values.DATABASE_URL || "") ||
        /@127\.0\.0\.1[:/]|@localhost[:/]/.test(values.DATABASE_URL || "")
      ) {
        const note =
          "NEXT_PUBLIC_SUPABASE_URL is hosted but DATABASE_URL still looks local — set DATABASE_URL (and keys) via Cursor Secrets";
        console.warn(`[agent-runtime cursor-start] WARN: ${note}`);
        /** @type {string[]} */ (bootExtra.notes).push(note);
      }
      console.log("[agent-runtime cursor-start] done");
      finish(0);
      return;
    }

    const start = runBashScript(join(SCRIPTS_DIR, "start-local-supabase.sh"), {
      cwd: projectRoot,
      env: childEnv,
    });
    bootExtra.localSupabaseStarted = start.status === 0;
    if (start.status !== 0) {
      console.warn(
        "[agent-runtime cursor-start] WARN: local Supabase did not start; database may be unavailable",
      );
      /** @type {string[]} */ (bootExtra.notes).push("local Supabase did not start");
      finish(start.status || 1);
      return;
    }

    if (config.migrateCmd) {
      console.log(`==> migrate: ${config.migrateCmd}`);
      bootExtra.migrateRan = true;
      const mig = runMigrate(config.migrateCmd, { cwd: projectRoot, env: childEnv });
      bootExtra.migrateOk = mig.status === 0;
      if (mig.status !== 0) {
        console.warn("[agent-runtime cursor-start] WARN: migrations failed");
        /** @type {string[]} */ (bootExtra.notes).push(`migrations failed: ${config.migrateCmd}`);
        finish(mig.status || 1);
        return;
      }
    } else {
      bootExtra.migrateRan = false;
      console.log("[agent-runtime cursor-start] no migrateCmd configured; skip migrations");
    }

    console.log("[agent-runtime cursor-start] done");
    finish(0);
  } catch (err) {
    console.error(`[agent-runtime cursor-start] ERROR: ${err instanceof Error ? err.message : err}`);
    /** @type {string[]} */ (bootExtra.notes).push(
      err instanceof Error ? err.message : String(err),
    );
    finish(1);
  }
}

/** Alias for non-Cursor adapters / manual boots. */
export async function cmdPrepare(args = [], opts = {}) {
  const vendor = parseVendorArg(args) || opts.vendor || process.env.AGENT_RUNTIME_VENDOR || "default";
  return cmdCursorStart(
    args.filter((a) => a !== "--vendor" && !a.startsWith("--vendor=")),
    { ...opts, vendor },
  );
}

/**
 * @param {string[]} args
 */
function parseVendorArg(args) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--vendor" && args[i + 1]) return args[i + 1];
    if (args[i].startsWith("--vendor=")) return args[i].slice("--vendor=".length);
  }
  return undefined;
}
