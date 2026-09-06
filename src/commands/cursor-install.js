import { join } from "node:path";
import { loadProjectConfig } from "../core/config.js";
import { runBashScript, runCommand, SCRIPTS_DIR } from "../core/run.js";

/**
 * Cursor Cloud Build entrypoint.
 *
 * Typical environment.json:
 *   "install": "pnpm install --frozen-lockfile && pnpm exec agent-runtime cursor-install"
 *
 * By default this does NOT re-run installCmd (deps already installed).
 * It ensures Docker/Supabase CLI and warms local Supabase images.
 *
 * @param {string[]} _args
 * @param {{ projectRoot?: string }} [opts]
 */
export async function cmdCursorInstall(_args = [], opts = {}) {
  const projectRoot = opts.projectRoot || process.cwd();
  const config = loadProjectConfig(projectRoot, { vendor: "cursor" });
  const installOpts = config.cursorInstall || {};
  const ensureRuntime = installOpts.ensureRuntime !== false;
  const warmImages = installOpts.warmSupabaseImages !== false;
  const runInstall = installOpts.runInstallCmd === true;

  const env = {
    ...process.env,
    AGENT_RUNTIME_PROJECT_ROOT: projectRoot,
  };

  console.log(`[agent-runtime cursor-install] project=${projectRoot}`);
  console.log(
    `[agent-runtime cursor-install] supabase ports api=${config.supabase.apiPort} db=${config.supabase.dbPort}`,
  );

  if (ensureRuntime) {
    console.log("==> ensure Docker + Supabase CLI");
    const r = runBashScript(join(SCRIPTS_DIR, "ensure-supabase-runtime.sh"), {
      cwd: projectRoot,
      env,
    });
    if (r.status !== 0) {
      throw new Error("ensure-supabase-runtime failed");
    }
  }

  if (runInstall) {
    const cmd =
      config.installCmd ||
      (config.packageManager === "npm" ? "npm ci" : "pnpm install --frozen-lockfile");
    console.log(`==> installCmd: ${cmd}`);
    const r = runCommand("bash", ["-lc", cmd], { cwd: projectRoot, env });
    if (r.status !== 0) {
      throw new Error(`installCmd failed: ${cmd}`);
    }
  } else {
    console.log("==> skip installCmd (run via environment.json before cursor-install; set cursorInstall.runInstallCmd=true to enable)");
  }

  if (warmImages) {
    console.log("==> warm local Supabase images");
    const r = runBashScript(join(SCRIPTS_DIR, "warm-supabase-images.sh"), {
      cwd: projectRoot,
      env,
    });
    if (r.status !== 0) {
      console.warn("[agent-runtime cursor-install] WARN: image warm failed (continuing)");
    }
  }

  console.log("[agent-runtime cursor-install] done");
}
