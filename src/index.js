/**
 * Public library entry.
 */
export { getPackageVersion } from "./cli.js";
export {
  builtInLocalDefaults,
  CONFIG_RELATIVE_PATH,
  defaultEnvKeys,
  loadProjectConfig,
  normalizeConfig,
} from "./core/config.js";
export { applyResolvedEnv, resolveEnvMap, resolveEnvValue, writeEnvLocal } from "./core/env.js";
export { isLocalSupabaseUrl } from "./core/supabase.js";
