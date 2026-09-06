import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_RELATIVE_PATH = ".cursor/agent-runtime.config.json";

/** Demo JWTs from local `supabase start` (not secrets). */
export const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

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
 * @property {SupabasePorts} supabase
 * @property {Record<string, string>} [envDefaults]
 * @property {string[]} [envKeys]
 * @property {{ runInstallCmd?: boolean, warmSupabaseImages?: boolean, ensureRuntime?: boolean }} [cursorInstall]
 * @property {{ resilient?: boolean }} [cursorStart]
 */

/**
 * @param {string} projectRoot
 * @returns {AgentRuntimeConfig}
 */
export function loadProjectConfig(projectRoot) {
  const path = join(projectRoot, CONFIG_RELATIVE_PATH);
  if (!existsSync(path)) {
    throw new Error(
      `Missing ${CONFIG_RELATIVE_PATH}. Run \`agent-runtime init\` or copy templates/project.config.example.json.`,
    );
  }
  /** @type {unknown} */
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`Invalid JSON in ${CONFIG_RELATIVE_PATH}: ${err instanceof Error ? err.message : err}`);
  }
  return normalizeConfig(raw, path);
}

/**
 * @param {unknown} raw
 * @param {string} pathForErrors
 * @returns {AgentRuntimeConfig}
 */
export function normalizeConfig(raw, pathForErrors = CONFIG_RELATIVE_PATH) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${pathForErrors} must be a JSON object`);
  }
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const supabaseRaw = obj.supabase;
  if (!supabaseRaw || typeof supabaseRaw !== "object" || Array.isArray(supabaseRaw)) {
    throw new Error(`${pathForErrors} must include supabase.apiPort and supabase.dbPort`);
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
 * Built-in local defaults derived from configured Supabase ports.
 * Project envDefaults override these; process env overrides both.
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
 * Default key order when envKeys is omitted.
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
