import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..");
const TEMPLATES = join(PACKAGE_ROOT, "templates");

/**
 * @param {string[]} args
 */
export async function cmdInit(args) {
  const cwd = resolve(process.cwd());
  const force = args.includes("--force");

  const configPath = join(cwd, ".cursor", "agent-runtime.config.json");
  const envJsonPath = join(cwd, ".cursor", "environment.json");
  const exampleConfigSrc = join(TEMPLATES, "project.config.example.json");
  const envTplSrc = join(TEMPLATES, "cursor", "environment.json.example");

  mkdirSync(join(cwd, ".cursor"), { recursive: true });

  if (existsSync(configPath) && !force) {
    console.log(`[agent-runtime init] skip existing ${rel(cwd, configPath)} (use --force to overwrite)`);
  } else {
    copyFileSync(exampleConfigSrc, configPath);
    console.log(`[agent-runtime init] wrote ${rel(cwd, configPath)}`);
  }

  if (existsSync(envJsonPath) && !force) {
    console.log(`[agent-runtime init] skip existing ${rel(cwd, envJsonPath)} (use --force to overwrite)`);
  } else {
    const tpl = readFileSync(envTplSrc, "utf8");
    writeFileSync(envJsonPath, tpl, "utf8");
    console.log(`[agent-runtime init] wrote ${rel(cwd, envJsonPath)}`);
  }

  console.log(`[agent-runtime init] done — edit .cursor/agent-runtime.config.json for ports / migrateCmd / envDefaults`);
}

/**
 * @param {string} cwd
 * @param {string} absolute
 */
function rel(cwd, absolute) {
  return absolute.startsWith(cwd) ? absolute.slice(cwd.length + 1) : absolute;
}
