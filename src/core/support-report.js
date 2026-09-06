import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolveImageToolVersions } from "./package-tools.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KIT_ROOT = join(__dirname, "..", "..");

export const SUPPORT_DIRNAME = ".agent-runtime";
export const INSTALL_SUPPORT_BASENAME = "install-support";
export const START_SUPPORT_BASENAME = "start-support";

/**
 * @returns {string}
 */
export function getKitVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(KIT_ROOT, "package.json"), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * @returns {string}
 */
export function getKitPackageName() {
  try {
    const pkg = JSON.parse(readFileSync(join(KIT_ROOT, "package.json"), "utf8"));
    return typeof pkg.name === "string" ? pkg.name : "@tomkrueger/agent-runtime-kit";
  } catch {
    return "@tomkrueger/agent-runtime-kit";
  }
}

/**
 * Best-effort how this kit was installed in the consumer (git pin, version, path).
 * @param {string} projectRoot
 */
export function detectKitInstallProvenance(projectRoot) {
  /** @type {Record<string, string>} */
  const out = {
    packageName: getKitPackageName(),
    kitVersion: getKitVersion(),
    kitPath: KIT_ROOT,
  };

  try {
    const consumerPkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
    const deps = {
      ...(consumerPkg.dependencies || {}),
      ...(consumerPkg.devDependencies || {}),
    };
    const name = out.packageName;
    if (typeof deps[name] === "string") {
      out.consumerDependency = deps[name];
    } else if (typeof deps["@gritgoattech/agent-runtime-kit"] === "string") {
      out.consumerDependency = deps["@gritgoattech/agent-runtime-kit"];
      out.consumerDependencyName = "@gritgoattech/agent-runtime-kit";
    }
  } catch {
    // ignore
  }

  return out;
}

/**
 * @param {string} command
 * @param {string[]} args
 */
function captureCommand(command, args = ["--version"]) {
  try {
    const r = spawnSync(command, args, { encoding: "utf8", timeout: 8000 });
    if (r.error || r.status !== 0) {
      return { available: false, version: null, error: r.error?.message || `exit ${r.status}` };
    }
    const text = `${r.stdout || ""}${r.stderr || ""}`.trim().split(/\r?\n/)[0] || "";
    return { available: true, version: text || null };
  } catch (err) {
    return { available: false, version: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Snapshot of tooling present on the machine.
 */
export function collectInstalledTools() {
  return {
    node: captureCommand("node", ["-v"]),
    npm: captureCommand("npm", ["-v"]),
    pnpm: captureCommand("pnpm", ["-v"]),
    docker: captureCommand("docker", ["--version"]),
    dockerd: captureCommand("dockerd", ["--version"]),
    supabase: captureCommand("supabase", ["--version"]),
    git: captureCommand("git", ["--version"]),
  };
}

/**
 * @param {string} projectRoot
 * @param {import("./config.js").AgentRuntimeConfig} config
 * @param {object} [extra]
 */
export function buildInstallSupportReport(projectRoot, config, extra = {}) {
  const tools = collectInstalledTools();
  const imageTools = resolveImageToolVersions(projectRoot, config);
  const kit = detectKitInstallProvenance(projectRoot);
  const now = new Date().toISOString();

  return {
    kind: "agent-runtime-install-support",
    generatedAt: now,
    phase: "install",
    kit,
    project: {
      root: projectRoot,
      environmentName: config.environmentName || null,
      packageManager: config.packageManager || null,
      installCmd: config.installCmd || null,
      migrateCmd: config.migrateCmd || null,
      supabase: config.supabase,
    },
    imageToolPins: imageTools,
    installedTools: tools,
    installActions: extra.installActions || {},
    host: {
      platform: process.platform,
      arch: process.arch,
      user: process.env.USER || process.env.USERNAME || null,
      cwd: process.cwd(),
    },
  };
}

/**
 * @param {string} projectRoot
 * @param {import("./config.js").AgentRuntimeConfig} config
 * @param {object} [extra]
 */
export function buildStartSupportReport(projectRoot, config, extra = {}) {
  const tools = collectInstalledTools();
  const kit = detectKitInstallProvenance(projectRoot);
  const now = new Date().toISOString();
  let installGeneratedAt = null;
  const installPath = join(projectRoot, SUPPORT_DIRNAME, `${INSTALL_SUPPORT_BASENAME}.json`);
  if (existsSync(installPath)) {
    try {
      const prev = JSON.parse(readFileSync(installPath, "utf8"));
      installGeneratedAt = prev.generatedAt || null;
    } catch {
      // ignore
    }
  }

  return {
    kind: "agent-runtime-start-support",
    generatedAt: now,
    phase: "start",
    linkedInstallGeneratedAt: installGeneratedAt,
    kit,
    project: {
      root: projectRoot,
      environmentName: config.environmentName || null,
      packageManager: config.packageManager || null,
      migrateCmd: config.migrateCmd || null,
      supabase: config.supabase,
    },
    boot: {
      supabaseMode: extra.supabaseMode || null,
      supabaseUrlHost: extra.supabaseUrlHost || null,
      envLocalPath: extra.envLocalPath || null,
      migrateRan: Boolean(extra.migrateRan),
      migrateOk: extra.migrateOk ?? null,
      localSupabaseStarted: extra.localSupabaseStarted ?? null,
      notes: extra.notes || [],
    },
    installedTools: tools,
    host: {
      platform: process.platform,
      arch: process.arch,
      user: process.env.USER || process.env.USERNAME || null,
      cwd: process.cwd(),
    },
  };
}

/**
 * @param {string} projectRoot
 * @param {string} basename
 * @param {Record<string, unknown>} report
 */
export function writeSupportReport(projectRoot, basename, report) {
  const dir = join(projectRoot, SUPPORT_DIRNAME);
  mkdirSync(dir, { recursive: true });
  const jsonPath = join(dir, `${basename}.json`);
  const mdPath = join(dir, `${basename}.md`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, renderSupportMarkdown(report), "utf8");
  return { jsonPath, mdPath };
}

/**
 * @param {Record<string, unknown>} report
 */
export function renderSupportMarkdown(report) {
  const kit = /** @type {Record<string, string>} */ (report.kit || {});
  const project = /** @type {Record<string, unknown>} */ (report.project || {});
  const tools = /** @type {Record<string, { available?: boolean, version?: string | null }>} */ (
    report.installedTools || {}
  );
  const lines = [];
  const title =
    report.phase === "start" ? "Agent Runtime — start support" : "Agent Runtime — install support";

  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`Generated: \`${report.generatedAt}\``);
  lines.push("");
  lines.push("## Agent Runtime Kit");
  lines.push("");
  lines.push(`- Package: \`${kit.packageName || "?"}\``);
  lines.push(`- Version: \`${kit.kitVersion || "?"}\``);
  if (kit.consumerDependency) {
    lines.push(
      `- Consumer pin: \`${kit.consumerDependencyName || kit.packageName}@${kit.consumerDependency}\``,
    );
  }
  lines.push(`- Resolved path: \`${kit.kitPath || "?"}\``);
  lines.push("");
  lines.push("## Project");
  lines.push("");
  lines.push(`- Root: \`${project.root || "?"}\``);
  lines.push(`- Environment name: \`${project.environmentName || "(unset)"}\``);
  lines.push(`- Package manager: \`${project.packageManager || "?"}\``);
  if (project.migrateCmd) lines.push(`- migrateCmd: \`${project.migrateCmd}\``);
  if (project.supabase && typeof project.supabase === "object") {
    const s = /** @type {Record<string, unknown>} */ (project.supabase);
    lines.push(`- Supabase ports: api=${s.apiPort} db=${s.dbPort} studio=${s.studioPort ?? "(default)"}`);
  }
  lines.push("");

  if (report.phase === "install") {
    const actions = /** @type {Record<string, unknown>} */ (report.installActions || {});
    const pins = /** @type {Record<string, unknown>} */ (report.imageToolPins || {});
    lines.push("## Install actions");
    lines.push("");
    lines.push(`- ensureRuntime: \`${actions.ensureRuntime}\``);
    lines.push(`- warmSupabaseImages: \`${actions.warmImages}\``);
    lines.push(`- ranInstallCmd: \`${actions.runInstall}\``);
    if (actions.warmImagesStatus != null) lines.push(`- warmImagesStatus: \`${actions.warmImagesStatus}\``);
    lines.push("");
    lines.push("## Image tool pins (Dockerfile sync)");
    lines.push("");
    lines.push(`- node: \`${pins.nodeVersion}\``);
    lines.push(`- pnpm: \`${pins.pnpmVersion}\``);
    lines.push(`- supabase CLI: \`${pins.supabaseCliVersion}\``);
    if (Array.isArray(pins.sources)) lines.push(`- sources: ${pins.sources.map((s) => `\`${s}\``).join(", ")}`);
    lines.push("");
  }

  if (report.phase === "start") {
    const boot = /** @type {Record<string, unknown>} */ (report.boot || {});
    lines.push("## Boot");
    lines.push("");
    if (report.linkedInstallGeneratedAt) {
      lines.push(`- Linked install report: \`${report.linkedInstallGeneratedAt}\``);
    }
    lines.push(`- Supabase mode: \`${boot.supabaseMode}\``);
    if (boot.supabaseUrlHost) lines.push(`- Supabase URL host: \`${boot.supabaseUrlHost}\``);
    if (boot.envLocalPath) lines.push(`- .env.local: \`${boot.envLocalPath}\``);
    lines.push(`- Local Supabase started: \`${boot.localSupabaseStarted}\``);
    lines.push(`- Migrations ran: \`${boot.migrateRan}\` ok=\`${boot.migrateOk}\``);
    if (Array.isArray(boot.notes) && boot.notes.length) {
      lines.push("- Notes:");
      for (const n of boot.notes) lines.push(`  - ${n}`);
    }
    lines.push("");
  }

  lines.push("## Tools detected on this machine");
  lines.push("");
  for (const [name, info] of Object.entries(tools)) {
    if (!info?.available) {
      lines.push(`- **${name}**: not available${info?.error ? ` (${info.error})` : ""}`);
    } else {
      lines.push(`- **${name}**: \`${info.version || "?"}\``);
    }
  }
  lines.push("");
  lines.push("_This file is written by `agent-runtime` for debugging Cloud Agent / self-hosted boots. Prefer reading the matching `.json` for structured data._");
  lines.push("");
  return `${lines.join("\n")}\n`;
}
