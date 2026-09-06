import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Repo-root shared config (preferred). */
export const BASE_CONFIG_FILENAME = "agent-runtime.config.json";
/** Legacy path from early kit versions. */
export const LEGACY_CONFIG_RELATIVE_PATH = ".cursor/agent-runtime.config.json";

/** Demo JWTs from local `supabase start` (not secrets). */
export const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/** Defaults stamped into the shared Cursor Dockerfile by `sync`. */
export const DEFAULT_NODE_VERSION = "22.22.2";
export const DEFAULT_PNPM_VERSION = "10.33.2";
export const DEFAULT_SUPABASE_CLI_VERSION = "2.114.0";

/**
 * @typedef {'cursor' | 'claude' | 'codex' | 'default'} AgentRuntimeVendor
 */

/**
 * @typedef {object} SupabasePorts
 * @property {number} apiPort
 * @property {number} dbPort
 * @property {number} [studioPort]
 */

/**
 * @typedef {object} AgentRuntimeConfig
 * @property {string} [environmentName]
 * @property {string} [packageManager]
 * @property {string} [installCmd]
 * @property {string} [devCmd]
 * @property {string} [migrateCmd]
 * @property {string} [nodeVersion]
 * @property {string} [pnpmVersion]
 * @property {string} [supabaseCliVersion]
 * @property {SupabasePorts} supabase
 * @property {Record<string, string>} [envDefaults]
 * @property {string[]} [envKeys]
 * @property {{ runInstallCmd?: boolean, warmSupabaseImages?: boolean, ensureRuntime?: boolean }} [cursorInstall]
 * @property {{ resilient?: boolean }} [cursorStart]
 */

/**
 * @param {AgentRuntimeVendor | string} vendor
 */
export function vendorConfigFilename(vendor) {
  if (!vendor || vendor === "default") return null;
  return `agent-runtime.config.${vendor}.json`;
}

/**
 * Resolve base config path (root preferred, legacy .cursor/ supported).
 * @param {string} projectRoot
 * @returns {{ path: string, legacy: boolean }}
 */
export function resolveBaseConfigPath(projectRoot) {
  const rootPath = join(projectRoot, BASE_CONFIG_FILENAME);
  if (existsSync(rootPath)) return { path: rootPath, legacy: false };
  const legacyPath = join(projectRoot, LEGACY_CONFIG_RELATIVE_PATH);
  if (existsSync(legacyPath)) return { path: legacyPath, legacy: true };
  return { path: rootPath, legacy: false };
}

/**
 * Deep-merge plain objects. Arrays and scalars from `overlay` replace.
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} overlay
 * @returns {Record<string, unknown>}
 */
export function deepMerge(base, overlay) {
  /** @type {Record<string, unknown>} */
  const out = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) continue;
    const existing = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      out[key] = deepMerge(
        /** @type {Record<string, unknown>} */ (existing),
        /** @type {Record<string, unknown>} */ (value),
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * @param {string} path
 * @returns {Record<string, unknown>}
 */
function readJsonObject(path) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`Invalid JSON in ${path}: ${err instanceof Error ? err.message : err}`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${path} must be a JSON object`);
  }
  return /** @type {Record<string, unknown>} */ (raw);
}

/**
 * Load base + optional vendor overlay, then normalize.
 * @param {string} projectRoot
 * @param {{ vendor?: AgentRuntimeVendor | string }} [opts]
 * @returns {AgentRuntimeConfig & { _meta?: { basePath: string, overlayPath?: string, legacy: boolean, vendor: string } }}
 */
export function loadProjectConfig(projectRoot, opts = {}) {
  const vendor = opts.vendor || process.env.AGENT_RUNTIME_VENDOR || "default";
  const { path: basePath, legacy } = resolveBaseConfigPath(projectRoot);
  if (!existsSync(basePath)) {
    throw new Error(
      `Missing ${BASE_CONFIG_FILENAME} at project root. Run \`agent-runtime init\` (or migrate from ${LEGACY_CONFIG_RELATIVE_PATH}).`,
    );
  }
  if (legacy) {
    console.warn(
      `[agent-runtime] WARN: using legacy ${LEGACY_CONFIG_RELATIVE_PATH}; move it to ./${BASE_CONFIG_FILENAME} (repo root)`,
    );
  }

  let merged = readJsonObject(basePath);
  /** @type {string | undefined} */
  let overlayPath;
  const overlayName = vendorConfigFilename(vendor);
  if (overlayName) {
    const candidate = join(projectRoot, overlayName);
    if (existsSync(candidate)) {
      overlayPath = candidate;
      merged = deepMerge(merged, readJsonObject(candidate));
    }
  }

  const config = normalizeConfig(merged, overlayPath || basePath);
  return Object.assign(config, {
    _meta: { basePath, overlayPath, legacy, vendor: String(vendor) },
  });
}

/**
 * @param {unknown} raw
 * @param {string} pathForErrors
 * @returns {AgentRuntimeConfig}
 */
export function normalizeConfig(raw, pathForErrors = BASE_CONFIG_FILENAME) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${pathForErrors} must be a JSON object`);
  }
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const supabaseRaw = obj.supabase;
  if (!supabaseRaw || typeof supabaseRaw !== "object" || Array.isArray(supabaseRaw)) {
    throw new Error(`${pathForErrors} must include supabase.apiPort and supabase.dbPort (usually in base config)`);
  }
  const supabaseObj = /** @type {Record<string, unknown>} */ (supabaseRaw);
  const apiPort = Number(supabaseObj.apiPort);
  const dbPort = Number(supabaseObj.dbPort);
  if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
    throw new Error(`${pathForErrors}: supabase.apiPort must be an integer port`);
  }
  if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
    throw new Error(`${pathForErrors}: supabase.dbPort must be an integer port`);
  }
  const studioPort =
    supabaseObj.studioPort === undefined ? undefined : Number(supabaseObj.studioPort);
  if (studioPort !== undefined && (!Number.isInteger(studioPort) || studioPort < 1 || studioPort > 65535)) {
    throw new Error(`${pathForErrors}: supabase.studioPort must be an integer port`);
  }

  /** @type {Record<string, string>} */
  const envDefaults = {};
  if (obj.envDefaults && typeof obj.envDefaults === "object" && !Array.isArray(obj.envDefaults)) {
    for (const [k, v] of Object.entries(/** @type {Record<string, unknown>} */ (obj.envDefaults))) {
      if (v === undefined || v === null) continue;
      envDefaults[k] = String(v);
    }
  }

  /** @type {string[] | undefined} */
  let envKeys;
  if (Array.isArray(obj.envKeys)) {
    envKeys = obj.envKeys.map((k) => String(k));
  }

  return {
    environmentName: typeof obj.environmentName === "string" ? obj.environmentName : undefined,
    packageManager: typeof obj.packageManager === "string" ? obj.packageManager : "pnpm",
    installCmd: typeof obj.installCmd === "string" ? obj.installCmd : undefined,
    devCmd: typeof obj.devCmd === "string" ? obj.devCmd : undefined,
    migrateCmd: typeof obj.migrateCmd === "string" ? obj.migrateCmd : undefined,
    nodeVersion: optionalToolVersion(obj.nodeVersion, "nodeVersion", pathForErrors),
    pnpmVersion: optionalToolVersion(obj.pnpmVersion, "pnpmVersion", pathForErrors),
    supabaseCliVersion: optionalToolVersion(
      obj.supabaseCliVersion,
      "supabaseCliVersion",
      pathForErrors,
    ),
    supabase: {
      apiPort,
      dbPort,
      ...(studioPort !== undefined ? { studioPort } : {}),
    },
    envDefaults,
    envKeys,
    cursorInstall:
      obj.cursorInstall && typeof obj.cursorInstall === "object" && !Array.isArray(obj.cursorInstall)
        ? /** @type {AgentRuntimeConfig['cursorInstall']} */ (obj.cursorInstall)
        : {},
    cursorStart:
      obj.cursorStart && typeof obj.cursorStart === "object" && !Array.isArray(obj.cursorStart)
        ? /** @type {AgentRuntimeConfig['cursorStart']} */ (obj.cursorStart)
        : {},
  };
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {string} pathForErrors
 * @returns {string | undefined}
 */
function optionalToolVersion(value, field, pathForErrors) {
  if (value === undefined || value === null || value === "") return undefined;
  return parseToolVersion(value, field, pathForErrors);
}

/**
 * Allow semver-ish tool pins only (safe to embed in Dockerfile ARG lines).
 * @param {unknown} value
 * @param {string} field
 * @param {string} pathForErrors
 */
function parseToolVersion(value, field, pathForErrors) {
  const s = String(value).trim();
  if (!/^[0-9]+(\.[0-9]+){0,3}([-+][A-Za-z0-9._-]+)?$/.test(s)) {
    throw new Error(
      `${pathForErrors}: ${field} must look like a version (e.g. "22.22.2" or "24"), got ${JSON.stringify(value)}`,
    );
  }
  return s;
}

/**
 * @param {AgentRuntimeConfig} config
 * @returns {Record<string, string>}
 */
export function builtInLocalDefaults(config) {
  const { apiPort, dbPort } = config.supabase;
  return {
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${apiPort}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: LOCAL_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_ROLE_KEY,
    DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${dbPort}/postgres`,
  };
}

/**
 * @param {AgentRuntimeConfig} config
 * @returns {string[]}
 */
export function defaultEnvKeys(config) {
  const fromDefaults = Object.keys(config.envDefaults || {});
  const builtIn = Object.keys(builtInLocalDefaults(config));
  const ordered = [];
  const seen = new Set();
  for (const k of [...fromDefaults, ...builtIn]) {
    if (seen.has(k)) continue;
    seen.add(k);
    ordered.push(k);
  }
  return ordered;
}

/** @deprecated use BASE_CONFIG_FILENAME */
export const CONFIG_RELATIVE_PATH = BASE_CONFIG_FILENAME;
