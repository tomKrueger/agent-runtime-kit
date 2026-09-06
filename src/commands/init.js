import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BASE_CONFIG_FILENAME,
  LEGACY_CONFIG_RELATIVE_PATH,
} from "../core/config.js";
import { cmdSync } from "./sync.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..");
const TEMPLATES = join(PACKAGE_ROOT, "templates");

/**
 * Scaffold base config (once) and refresh vendor adapters from it.
 *
 * Flags:
 *   --force / --refresh   Regenerate adapters (environment.json) from config. Never wipes config.
 *   --force-config        DANGEROUS: overwrite base agent-runtime.config.json from the template.
 *
 * Does not write vendor overlays — use `agent-runtime overlay <cursor|claude>`.
 *
 * @param {string[]} args
 */
export async function cmdInit(args) {
  const cwd = resolve(process.cwd());
  const refreshAdapters = args.includes("--force") || args.includes("--refresh");
  const forceConfig = args.includes("--force-config");

  const configPath = join(cwd, BASE_CONFIG_FILENAME);
  const legacyPath = join(cwd, LEGACY_CONFIG_RELATIVE_PATH);
  const exampleConfigSrc = join(TEMPLATES, "project.config.example.json");

  const derivedName = deriveEnvironmentName(cwd);

  if (existsSync(legacyPath) && !existsSync(configPath)) {
    console.log(`[agent-runtime init] found legacy ${LEGACY_CONFIG_RELATIVE_PATH} — run sync to move it to root`);
  }

  if (existsSync(configPath) && !forceConfig) {
    console.log(`[agent-runtime init] keep existing ${BASE_CONFIG_FILENAME} (use --force-config to replace from template)`);
  } else if (forceConfig && existsSync(configPath)) {
    const backup = `${configPath}.bak`;
    writeFileSync(backup, readFileSync(configPath));
    const config = JSON.parse(readFileSync(exampleConfigSrc, "utf8"));
    config.environmentName = derivedName;
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    console.warn(`[agent-runtime init] OVERWROTE ${BASE_CONFIG_FILENAME} (backup: ${basename(backup)})`);
  } else if (!existsSync(configPath)) {
    const config = JSON.parse(readFileSync(exampleConfigSrc, "utf8"));
    config.environmentName = derivedName;
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    console.log(`[agent-runtime init] wrote ${BASE_CONFIG_FILENAME} (environmentName=${derivedName})`);
  }

  mkdirSync(join(cwd, ".cursor"), { recursive: true });

  const envJsonPath = join(cwd, ".cursor", "environment.json");
  if (refreshAdapters || !existsSync(envJsonPath)) {
    await cmdSync(["--vendor=cursor"], { projectRoot: cwd });
  } else {
    console.log(
      `[agent-runtime init] keep existing .cursor/environment.json (run \`agent-runtime sync\` or \`init --refresh\` after config changes)`,
    );
  }

  console.log(`[agent-runtime init] done`);
  console.log(`  Shared config:  ./${BASE_CONFIG_FILENAME}`);
  console.log(`  Vendor overlay: agent-runtime overlay cursor|claude`);
  console.log(`  After edits:    pnpm exec agent-runtime sync`);
}

/**
 * @param {string} cwd
 */
export function deriveEnvironmentName(cwd) {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
    if (typeof pkg.name === "string" && pkg.name.trim()) {
      let base = pkg.name.includes("/") ? pkg.name.split("/").pop() : pkg.name;
      base = String(base)
        .replace(/@/g, "")
        .replace(/_web_nextjs$/i, "")
        .replace(/_web$/i, "")
        .replace(/[-_]?saas$/i, "")
        .replace(/_/g, "-")
        .replace(/[^a-zA-Z0-9.-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (base) return `${base}-dev`;
    }
  } catch {
    // fall through
  }
  const dir = basename(cwd)
    .replace(/_web_nextjs$/i, "")
    .replace(/_/g, "-");
  return `${dir}-dev`;
}
