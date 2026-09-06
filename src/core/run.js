import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = join(__dirname, "..", "..");
export const SCRIPTS_DIR = join(PACKAGE_ROOT, "scripts");

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, stdio?: 'inherit' | 'pipe' }} [opts]
 * @returns {{ status: number | null, error?: Error }}
 */
export function runCommand(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: opts.cwd,
    env: opts.env || process.env,
    stdio: opts.stdio ?? "inherit",
    shell: false,
  });
  if (result.error) return { status: 1, error: result.error };
  return { status: result.status === null ? 1 : result.status };
}

/**
 * Run a shell script via bash.
 * @param {string} scriptPath
 * @param {{ cwd: string, env?: NodeJS.ProcessEnv }} opts
 */
export function runBashScript(scriptPath, opts) {
  return runCommand("bash", [scriptPath], {
    cwd: opts.cwd,
    env: opts.env || process.env,
    stdio: "inherit",
  });
}

/**
 * Run migrateCmd via the user shell so pnpm/npm/npx work as expected.
 * @param {string} migrateCmd
 * @param {{ cwd: string, env?: NodeJS.ProcessEnv }} opts
 */
export function runMigrate(migrateCmd, opts) {
  return runCommand("bash", ["-lc", migrateCmd], {
    cwd: opts.cwd,
    env: opts.env || process.env,
    stdio: "inherit",
  });
}
