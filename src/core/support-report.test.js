import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildInstallSupportReport,
  buildStartSupportReport,
  getKitVersion,
  renderSupportMarkdown,
  writeSupportReport,
} from "./support-report.js";

function minimalConfig() {
  return {
    environmentName: "demo-dev",
    packageManager: "pnpm",
    migrateCmd: "pnpm db:migrate:local",
    supabase: { apiPort: 60321, dbPort: 60322, studioPort: 60323 },
  };
}

test("getKitVersion reads package.json version", () => {
  assert.match(getKitVersion(), /^\d+\.\d+\.\d+/);
});

test("writeSupportReport writes json and markdown with kit version", () => {
  const dir = mkdtempSync(join(tmpdir(), "ark-support-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo", dependencies: {} }));
  const report = buildInstallSupportReport(dir, minimalConfig(), {
    installActions: { ensureRuntime: true, warmImages: true, runInstall: false },
  });
  const paths = writeSupportReport(dir, "install-support", report);
  const json = JSON.parse(readFileSync(paths.jsonPath, "utf8"));
  assert.equal(json.kind, "agent-runtime-install-support");
  assert.equal(json.kit.kitVersion, getKitVersion());
  assert.ok(json.generatedAt);
  assert.ok(json.installedTools.node);

  const md = readFileSync(paths.mdPath, "utf8");
  assert.match(md, /Agent Runtime Kit/);
  assert.match(md, new RegExp(getKitVersion().replace(/\./g, "\\.")));
});

test("buildStartSupportReport links prior install timestamp", () => {
  const dir = mkdtempSync(join(tmpdir(), "ark-support-"));
  writeFileSync(join(dir, "package.json"), "{}");
  const install = buildInstallSupportReport(dir, minimalConfig(), { installActions: {} });
  writeSupportReport(dir, "install-support", install);

  const start = buildStartSupportReport(dir, minimalConfig(), {
    supabaseMode: "local",
    migrateRan: true,
    migrateOk: true,
    localSupabaseStarted: true,
  });
  assert.equal(start.linkedInstallGeneratedAt, install.generatedAt);
  assert.match(renderSupportMarkdown(start), /Boot/);
});
