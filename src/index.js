/**
 * Public library entry.
 */
export { getPackageVersion } from "./cli.js";
export {
  BASE_CONFIG_FILENAME,
  builtInLocalDefaults,
  CONFIG_RELATIVE_PATH,
  deepMerge,
  defaultEnvKeys,
  LEGACY_CONFIG_RELATIVE_PATH,
  loadProjectConfig,
  normalizeConfig,
  vendorConfigFilename,
} from "./core/config.js";
export { applyResolvedEnv, resolveEnvMap, resolveEnvValue, writeEnvLocal } from "./core/env.js";
export { isLocalSupabaseUrl } from "./core/supabase.js";
