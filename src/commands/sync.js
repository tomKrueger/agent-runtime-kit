import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BASE_CONFIG_FILENAME,
  LEGACY_CONFIG_RELATIVE_PATH,
  loadProjectConfig,
} from "../core/config.js";
import { resolveImageToolVersions } from "../core/package-tools.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..");
const TEMPLATES = join(PACKAGE_ROOT, "templates");
const CURSOR_DOCKERFILE_TEMPLATE = join(TEMPLATES, "cursor", "Dockerfile");

/**
 * Regenerate vendor adapter files from merged config.
 * Never modifies agent-runtime.config.json.
 *
 * @param {string[]} args
 * @param {{ projectRoot?: string }} [opts]
 */
export async function cmdSync(args = [], opts = {}) {
  const projectRoot = opts.projectRoot || process.cwd();
  const vendors = parseVendors(args);
  const migrateLegacy = !args.includes("--no-migrate-legacy");

  if (migrateLegacy) {
    maybeMigrateLegacyConfig(projectRoot);
  }

  for (const vendor of vendors) {
    if (vendor === "cursor") {
      syncCursorEnvironment(projectRoot);
    } else if (vendor === "claude") {
      syncClaudeFragment(projectRoot);
    } else {
      console.log(`[agent-runtime sync] skip unknown vendor: ${vendor}`);
    }
  }

  console.log("[agent-runtime sync] done — edit agent-runtime.config*.json then re-run sync to refresh adapters");
}

/**
 * @param {string[]} args
 * @returns {string[]}
 */
function parseVendors(args) {
  /** @type {string[]} */
  const vendors = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--vendor" && args[i + 1]) {
      vendors.push(args[++i]);
    } else if (a.startsWith("--vendor=")) {
      vendors.push(a.slice("--vendor=".length));
    }
  }
  return vendors.length ? vendors : ["cursor"];
}

/**
 * @param {string} projectRoot
 */
function maybeMigrateLegacyConfig(projectRoot) {
  const rootPath = join(projectRoot, BASE_CONFIG_FILENAME);
  const legacyPath = join(projectRoot, LEGACY_CONFIG_RELATIVE_PATH);
  if (existsSync(rootPath) || !existsSync(legacyPath)) return;
  renameSync(legacyPath, rootPath);
  console.log(`[agent-runtime sync] moved ${LEGACY_CONFIG_RELATIVE_PATH} → ${BASE_CONFIG_FILENAME}`);
}

/**
 * Write .cursor/environment.json from merged cursor config.
 * Cursor must read this file; values are derived from agent-runtime config so you
 * don't maintain ports/name/install in two places by hand.
 * @param {string} projectRoot
 */
export function syncCursorEnvironment(projectRoot) {
  const config = loadProjectConfig(projectRoot, { vendor: "cursor" });
  const packageManager = config.packageManager || "pnpm";
  const installCmd =
    config.installCmd ||
    (packageManager === "npm" ? "npm ci" : "pnpm install --frozen-lockfile");
  const exec = packageManager === "npm" ? "npx" : "pnpm exec";
  const devCmd = config.devCmd || `${packageManager} run dev`;
  const name = config.environmentName || "app-dev";
  const apiPort = config.supabase.apiPort;
  const dbPort = config.supabase.dbPort;
  const studioPort = config.supabase.studioPort ?? apiPort + 2;

  mkdirSync(join(projectRoot, ".cursor"), { recursive: true });
  syncCursorDockerfile(projectRoot, config);

  const envJsonPath = join(projectRoot, ".cursor", "environment.json");

  // Preserve build/user/snapshot fields if already present.
  /** @type {Record<string, unknown>} */
  let existing = {};
  if (existsSync(envJsonPath)) {
    try {
      existing = JSON.parse(readFileSync(envJsonPath, "utf8"));
    } catch {
      existing = {};
    }
  }

  const tpl = JSON.parse(readFileSync(join(TEMPLATES, "cursor", "environment.json.example"), "utf8"));
  /** @type {Record<string, unknown>} */
  const next = {
    ...tpl,
    ...existing,
    name,
    install: `${installCmd} && ${exec} agent-runtime cursor-install`,
    start: `${exec} agent-runtime cursor-start`,
    ports: [
      { name: "web", port: 3000 },
      { name: "supabase-api", port: apiPort },
      { name: "supabase-db", port: dbPort },
      { name: "supabase-studio", port: studioPort },
    ],
  };

  if (!next.user) next.user = "ubuntu";
  // Always point at the kit-managed Dockerfile under .cursor/
  next.build = { dockerfile: "Dockerfile", context: ".." };
  if (!Array.isArray(next.terminals) || next.terminals.length === 0) {
    next.terminals = [{ name: "dev", command: devCmd, description: "App dev server" }];
  } else if (next.terminals[0] && typeof next.terminals[0] === "object") {
    next.terminals = [
      { .../** @type {Record<string, unknown>} */ (next.terminals[0]), command: devCmd },
      ...next.terminals.slice(1),
    ];
  }

  const body = `${JSON.stringify(next, null, 2)}\n`;
  // Cursor schema allows comments — stamp a reminder above JSON via a .md note is cleaner;
  // keep pure JSON for maximum compatibility with tooling that strips comments.
  writeFileSync(envJsonPath, body, "utf8");
  console.log(
    `[agent-runtime sync] wrote .cursor/environment.json from config (name=${name}, ports=${apiPort}/${dbPort}/${studioPort})`,
  );
}

/**
 * Render the shared Cursor Cloud Agent Dockerfile into the consumer repo.
 * Cursor builds from `.cursor/Dockerfile` (see environment.json build.dockerfile).
 *
 * Tool versions: explicit config → package.json (engines.node / packageManager) → kit defaults.
 *
 * @param {string} projectRoot
 * @param {import("../core/config.js").AgentRuntimeConfig} [config]
 */
export function syncCursorDockerfile(projectRoot, config) {
  if (!existsSync(CURSOR_DOCKERFILE_TEMPLATE)) {
    console.warn(
      `[agent-runtime sync] WARN: missing kit Dockerfile template at ${CURSOR_DOCKERFILE_TEMPLATE}`,
    );
    return;
  }
  const cfg = config || loadProjectConfig(projectRoot, { vendor: "cursor" });
  const { nodeVersion, pnpmVersion, supabaseCliVersion, sources } = resolveImageToolVersions(
    projectRoot,
    cfg,
  );

  let body = readFileSync(CURSOR_DOCKERFILE_TEMPLATE, "utf8");
  body = stampDockerfileArg(body, "NODE_VERSION", nodeVersion);
  body = stampDockerfileArg(body, "PNPM_VERSION", pnpmVersion);
  body = stampDockerfileArg(body, "SUPABASE_CLI_VERSION", supabaseCliVersion);

  const dest = join(projectRoot, ".cursor", "Dockerfile");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, body, "utf8");
  console.log(
    `[agent-runtime sync] wrote .cursor/Dockerfile (node=${nodeVersion}, pnpm=${pnpmVersion}, supabase-cli=${supabaseCliVersion}; via ${sources.join(", ")})`,
  );
}

/**
 * @param {string} dockerfile
 * @param {string} name
 * @param {string} value
 */
export function stampDockerfileArg(dockerfile, name, value) {
  const re = new RegExp(`^ARG ${name}=.*$`, "m");
  if (!re.test(dockerfile)) {
    throw new Error(`Dockerfile template missing ARG ${name}=… line`);
  }
  return dockerfile.replace(re, `ARG ${name}=${value}`);
}

/**
 * @param {string} projectRoot
 */
function syncClaudeFragment(projectRoot) {
  const config = loadProjectConfig(projectRoot, { vendor: "claude" });
  const dir = join(projectRoot, ".agent-runtime");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, "CLAUDE.bootstrap.md");
  const fragment = `# Agent runtime (Claude)

After checkout, bootstrap the workspace with the same shared config used by Cursor:

\`\`\`bash
pnpm exec agent-runtime prepare --vendor=claude
# or: AGENT_RUNTIME_VENDOR=claude pnpm exec agent-runtime prepare
\`\`\`

Merged config: \`${BASE_CONFIG_FILENAME}\` + optional \`agent-runtime.config.claude.json\`.

Environment name: \`${config.environmentName || "(unset)"}\`  
Supabase ports: api=${config.supabase.apiPort} db=${config.supabase.dbPort}  
migrateCmd: \`${config.migrateCmd || "(none)"}\`

Re-run \`pnpm exec agent-runtime sync --vendor=claude\` after editing config.
`;
  writeFileSync(out, fragment, "utf8");
  console.log(`[agent-runtime sync] wrote .agent-runtime/CLAUDE.bootstrap.md`);
}
