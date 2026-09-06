import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { vendorConfigFilename } from "../core/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..");
const TEMPLATES = join(PACKAGE_ROOT, "templates");

/** @type {Record<string, string>} */
const OVERLAY_TEMPLATES = {
  cursor: "agent-runtime.config.cursor.example.json",
  claude: "agent-runtime.config.claude.example.json",
};

/**
 * Scaffold a vendor overlay config only when asked.
 *
 * Usage:
 *   agent-runtime overlay cursor
 *   agent-runtime overlay claude
 *   agent-runtime overlay cursor --force
 *
 * @param {string[]} args
 */
export async function cmdOverlay(args) {
  const force = args.includes("--force");
  const vendor = args.find((a) => !a.startsWith("-"));

  if (!vendor || !OVERLAY_TEMPLATES[vendor]) {
    console.error(
      `[agent-runtime overlay] usage: agent-runtime overlay <cursor|claude> [--force]`,
    );
    process.exitCode = 1;
    return;
  }

  const cwd = resolve(process.cwd());
  const destName = vendorConfigFilename(vendor);
  const dest = join(cwd, destName);
  const src = join(TEMPLATES, OVERLAY_TEMPLATES[vendor]);

  if (!existsSync(src)) {
    console.error(`[agent-runtime overlay] missing template for ${vendor}: ${basename(src)}`);
    process.exitCode = 1;
    return;
  }

  if (existsSync(dest) && !force) {
    console.log(
      `[agent-runtime overlay] keep existing ${destName} (use --force to replace from template)`,
    );
    return;
  }

  if (existsSync(dest) && force) {
    const backup = `${dest}.bak`;
    writeFileSync(backup, readFileSync(dest));
    writeFileSync(dest, readFileSync(src));
    console.warn(
      `[agent-runtime overlay] OVERWROTE ${destName} (backup: ${basename(backup)})`,
    );
    return;
  }

  writeFileSync(dest, readFileSync(src));
  console.log(`[agent-runtime overlay] wrote ${destName}`);
  console.log(`  Edit this file, then: pnpm exec agent-runtime sync`);
}
