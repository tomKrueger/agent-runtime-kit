import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
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

  const derivedName = deriveEnvironmentName(cwd);

  if (existsSync(configPath) && !force) {
    console.log(`[agent-runtime init] skip existing ${rel(cwd, configPath)} (use --force to overwrite)`);
  } else {
    const config = JSON.parse(readFileSync(exampleConfigSrc, "utf8"));
    config.environmentName = derivedName;
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    console.log(`[agent-runtime init] wrote ${rel(cwd, configPath)} (environmentName=${derivedName})`);
  }

  /** @type {{ environmentName?: string, supabase?: { apiPort?: number, dbPort?: number, studioPort?: number }, packageManager?: string, installCmd?: string, devCmd?: string }} */
  let projectConfig = {};
  try {
    projectConfig = JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    projectConfig = {};
  }

  const environmentName = projectConfig.environmentName || derivedName;
  const apiPort = projectConfig.supabase?.apiPort ?? 54321;
  const dbPort = projectConfig.supabase?.dbPort ?? 54322;
  const studioPort = projectConfig.supabase?.studioPort ?? 54323;
  const packageManager = projectConfig.packageManager || "pnpm";
  const installCmd =
    projectConfig.installCmd ||
    (packageManager === "npm" ? "npm ci" : "pnpm install --frozen-lockfile");
  const devCmd = projectConfig.devCmd || `${packageManager} run dev`;

  if (existsSync(envJsonPath) && !force) {
    console.log(`[agent-runtime init] skip existing ${rel(cwd, envJsonPath)} (use --force to overwrite)`);
  } else {
    /** @type {Record<string, unknown>} */
    const envJson = JSON.parse(readFileSync(envTplSrc, "utf8"));
    envJson.name = environmentName;
    envJson.install = `${installCmd} && ${packageManager === "npm" ? "npx" : "pnpm exec"} agent-runtime cursor-install`;
    envJson.start = `${packageManager === "npm" ? "npx" : "pnpm exec"} agent-runtime cursor-start`;
    if (Array.isArray(envJson.terminals) && envJson.terminals[0] && typeof envJson.terminals[0] === "object") {
      envJson.terminals[0].command = devCmd;
    }
    envJson.ports = [
      { name: "web", port: 3000 },
      { name: "supabase-api", port: apiPort },
      { name: "supabase-db", port: dbPort },
      { name: "supabase-studio", port: studioPort },
    ];
    writeFileSync(envJsonPath, `${JSON.stringify(envJson, null, 2)}\n`, "utf8");
    console.log(`[agent-runtime init] wrote ${rel(cwd, envJsonPath)} (name=${environmentName})`);
  }

  console.log(
    `[agent-runtime init] done — set environmentName / ports in .cursor/agent-runtime.config.json (Cursor "name" is a display label, not the npm package name)`,
  );
}

/**
 * Prefer an explicit product-ish label over the raw npm package name.
 * package.json names like hresalehub_web_nextjs become hresalehub-dev.
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

/**
 * @param {string} cwd
 * @param {string} absolute
 */
function rel(cwd, absolute) {
  return absolute.startsWith(cwd) ? absolute.slice(cwd.length + 1) : absolute;
}
