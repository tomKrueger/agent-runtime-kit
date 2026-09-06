import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cmdCursorInstall } from "./commands/cursor-install.js";
import { cmdCursorStart, cmdPrepare } from "./commands/cursor-start.js";
import { cmdHelp } from "./commands/help.js";
import { cmdInit } from "./commands/init.js";
import { cmdVersion } from "./commands/version.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getPackageVersion() {
  const pkgPath = join(__dirname, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  return pkg.version;
}

/**
 * @param {string[]} args
 */
export async function runCli(args) {
  const [command = "help", ...rest] = args;

  switch (command) {
    case "-h":
    case "--help":
    case "help":
      cmdHelp();
      return;
    case "-V":
    case "--version":
    case "version":
      cmdVersion(getPackageVersion());
      return;
    case "init":
      await cmdInit(rest);
      return;
    case "cursor-install":
      await cmdCursorInstall(rest);
      return;
    case "cursor-start":
      await cmdCursorStart(rest);
      return;
    case "prepare":
      await cmdPrepare(rest);
      return;
    case "sync":
    case "codex-setup":
    case "claude-bootstrap":
    case "selfhosted-prepare":
      console.error(
        `[agent-runtime] "${command}" is not implemented yet (adapters beyond Cursor). Use prepare / cursor-start for workspace bootstrap.`,
      );
      process.exitCode = 2;
      return;
    default:
      console.error(`[agent-runtime] unknown command: ${command}`);
      cmdHelp();
      process.exitCode = 1;
  }
}
