import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_NODE_VERSION,
  DEFAULT_PNPM_VERSION,
  DEFAULT_SUPABASE_CLI_VERSION,
} from "./config.js";

/**
 * Exact Node builds used when package.json only specifies a major / range
 * (e.g. engines.node "24.x"). Bump deliberately when refreshing the kit image.
 */
export const NODE_MAJOR_PINS = {
  20: "20.19.5",
  22: "22.22.2",
  24: "24.11.0",
};

/**
 * @param {string} projectRoot
 * @returns {Record<string, unknown> | null}
 */
export function readProjectPackageJson(projectRoot) {
  const path = join(projectRoot, "package.json");
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Resolve Dockerfile tool pins for a consumer app.
 *
 * Node precedence:
 *   1. Explicit agent-runtime.config.json `nodeVersion`
 *   2. `.nvmrc` or `.node-version`
 *   3. package.json `engines.node`
 *   4. Kit default
 *
 * pnpm precedence:
 *   1. Explicit `pnpmVersion`
 *   2. package.json `packageManager` (`pnpm@x.y.z`)
 *   3. Kit default
 *
 * @param {string} projectRoot
 * @param {{
 *   nodeVersion?: string,
 *   pnpmVersion?: string,
 *   supabaseCliVersion?: string,
 * }} config
 */
export function resolveImageToolVersions(projectRoot, config = {}) {
  const pkg = readProjectPackageJson(projectRoot);
  const fromPkg = pkg ? versionsFromPackageJson(pkg) : {};
  const fromNvm = resolveNodeVersionFromNvmFiles(projectRoot);

  const nodeVersion =
    config.nodeVersion || fromNvm?.version || fromPkg.nodeVersion || DEFAULT_NODE_VERSION;
  const pnpmVersion = config.pnpmVersion || fromPkg.pnpmVersion || DEFAULT_PNPM_VERSION;
  const supabaseCliVersion = config.supabaseCliVersion || DEFAULT_SUPABASE_CLI_VERSION;

  /** @type {string[]} */
  const sources = [];
  if (config.nodeVersion) sources.push("config.nodeVersion");
  else if (fromNvm) sources.push(fromNvm.source);
  else if (fromPkg.nodeVersion) sources.push("package.json engines.node");
  else sources.push("kit default node");

  if (config.pnpmVersion) sources.push("config.pnpmVersion");
  else if (fromPkg.pnpmVersion) sources.push("package.json packageManager");
  else sources.push("kit default pnpm");

  return { nodeVersion, pnpmVersion, supabaseCliVersion, sources };
}

/**
 * Read `.nvmrc` or `.node-version` (first match wins).
 * @param {string} projectRoot
 * @returns {{ version: string, source: string } | null}
 */
export function resolveNodeVersionFromNvmFiles(projectRoot) {
  for (const name of [".nvmrc", ".node-version"]) {
    const path = join(projectRoot, name);
    if (!existsSync(path)) continue;
    let text;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const line = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#"));
    if (!line) continue;
    // Allow optional leading "v" (nvm style): v22.22.2
    const cleaned = line.replace(/^v/i, "");
    const resolved = resolveNodeVersionFromEngines(cleaned);
    if (resolved) return { version: resolved, source: name };
  }
  return null;
}

/**
 * @param {Record<string, unknown>} pkg
 */
export function versionsFromPackageJson(pkg) {
  /** @type {{ nodeVersion?: string, pnpmVersion?: string }} */
  const out = {};

  const engines = pkg.engines;
  if (engines && typeof engines === "object" && !Array.isArray(engines)) {
    const node = /** @type {Record<string, unknown>} */ (engines).node;
    const resolved = resolveNodeVersionFromEngines(node);
    if (resolved) out.nodeVersion = resolved;
  }

  if (typeof pkg.packageManager === "string") {
    const pnpm = resolvePnpmVersionFromPackageManager(pkg.packageManager);
    if (pnpm) out.pnpmVersion = pnpm;
  }

  return out;
}

/**
 * Map engines.node values to an exact Node build for the Dockerfile tarball URL.
 * @param {unknown} enginesNode
 * @returns {string | null}
 */
export function resolveNodeVersionFromEngines(enginesNode) {
  if (enginesNode === undefined || enginesNode === null || enginesNode === "") return null;
  const s = String(enginesNode).trim();

  const exact = s.match(/^(\d+\.\d+\.\d+)(?:[-+][A-Za-z0-9._-]+)?$/);
  if (exact) return exact[1];

  const majorOnly = s.match(/^(\d+)$/);
  if (majorOnly) return pinForNodeMajor(Number(majorOnly[1]));

  const majorX = s.match(/^(\d+)\.(?:x|\*)$/i);
  if (majorX) return pinForNodeMajor(Number(majorX[1]));

  const caretOrTilde = s.match(/^[~^]\s*(\d+)/);
  if (caretOrTilde) return pinForNodeMajor(Number(caretOrTilde[1]));

  const ge = s.match(/^>=\s*(\d+)/);
  if (ge) return pinForNodeMajor(Number(ge[1]));

  const eq = s.match(/^=\s*(\d+(?:\.\d+){0,2})/);
  if (eq) {
    const parts = eq[1].split(".");
    if (parts.length === 3) return eq[1];
    return pinForNodeMajor(Number(parts[0]));
  }

  return null;
}

/**
 * @param {string} packageManagerField e.g. "pnpm@10.33.2"
 * @returns {string | null}
 */
export function resolvePnpmVersionFromPackageManager(packageManagerField) {
  const m = String(packageManagerField).trim().match(/^pnpm@(\d+(?:\.\d+){0,3})$/i);
  return m ? m[1] : null;
}

/**
 * @param {number} major
 */
function pinForNodeMajor(major) {
  if (!Number.isInteger(major) || major < 1) return null;
  if (NODE_MAJOR_PINS[major]) return NODE_MAJOR_PINS[major];
  // Unknown major: still produce a concrete-looking pin; sync can override via config.
  return `${major}.0.0`;
}
