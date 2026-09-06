import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { cmdOverlay } from "./overlay.js";

test("overlay cursor writes vendor config once", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ark-overlay-"));
  const prev = process.cwd();
  process.chdir(dir);
  try {
    await cmdOverlay(["cursor"]);
    const dest = join(dir, "agent-runtime.config.cursor.json");
    assert.equal(existsSync(dest), true);
    const body = JSON.parse(readFileSync(dest, "utf8"));
    assert.equal(body.cursorInstall?.ensureRuntime, true);

    await cmdOverlay(["cursor"]);
    assert.equal(existsSync(`${dest}.bak`), false);
  } finally {
    process.chdir(prev);
  }
});

test("overlay --force replaces existing overlay with backup", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ark-overlay-"));
  const prev = process.cwd();
  process.chdir(dir);
  try {
    const dest = join(dir, "agent-runtime.config.cursor.json");
    writeFileSync(dest, `${JSON.stringify({ custom: true }, null, 2)}\n`);
    await cmdOverlay(["cursor", "--force"]);
    assert.equal(existsSync(`${dest}.bak`), true);
    const body = JSON.parse(readFileSync(dest, "utf8"));
    assert.equal(body.custom, undefined);
    assert.equal(body.cursorInstall?.ensureRuntime, true);
  } finally {
    process.chdir(prev);
  }
});

test("overlay rejects unknown vendor", async () => {
  const prevCode = process.exitCode;
  process.exitCode = 0;
  await cmdOverlay(["codex"]);
  assert.equal(process.exitCode, 1);
  process.exitCode = prevCode;
});
