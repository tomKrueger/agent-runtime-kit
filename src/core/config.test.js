import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { deepMerge, loadProjectConfig, normalizeConfig } from "./config.js";

test("deepMerge overlays nested objects and replaces arrays", () => {
  const merged = deepMerge(
    { a: 1, supabase: { apiPort: 1, dbPort: 2 }, envKeys: ["A"], envDefaults: { X: "1" } },
    { supabase: { apiPort: 60321 }, envKeys: ["B"], envDefaults: { Y: "2" } },
  );
  assert.equal(merged.a, 1);
  assert.deepEqual(merged.supabase, { apiPort: 60321, dbPort: 2 });
  assert.deepEqual(merged.envKeys, ["B"]);
  assert.deepEqual(merged.envDefaults, { X: "1", Y: "2" });
});

test("loadProjectConfig merges cursor overlay", () => {
  const dir = mkdtempSync(join(tmpdir(), "ark-"));
  writeFileSync(
    join(dir, "agent-runtime.config.json"),
    JSON.stringify({
      environmentName: "base-dev",
      supabase: { apiPort: 60321, dbPort: 60322, studioPort: 60323 },
      envDefaults: { SESSION_SECRET: "base" },
    }),
  );
  writeFileSync(
    join(dir, "agent-runtime.config.cursor.json"),
    JSON.stringify({
      environmentName: "cursor-dev",
      envDefaults: { SESSION_SECRET: "cursor" },
    }),
  );
  const cfg = loadProjectConfig(dir, { vendor: "cursor" });
  assert.equal(cfg.environmentName, "cursor-dev");
  assert.equal(cfg.envDefaults.SESSION_SECRET, "cursor");
  assert.equal(cfg.supabase.apiPort, 60321);
});

test("loadProjectConfig default vendor ignores cursor overlay", () => {
  const dir = mkdtempSync(join(tmpdir(), "ark-"));
  writeFileSync(
    join(dir, "agent-runtime.config.json"),
    JSON.stringify({
      environmentName: "base-dev",
      supabase: { apiPort: 60321, dbPort: 60322 },
    }),
  );
  writeFileSync(
    join(dir, "agent-runtime.config.cursor.json"),
    JSON.stringify({ environmentName: "cursor-dev" }),
  );
  const cfg = loadProjectConfig(dir, { vendor: "default" });
  assert.equal(cfg.environmentName, "base-dev");
});

test("loadProjectConfig reads legacy .cursor path with warning path", () => {
  const dir = mkdtempSync(join(tmpdir(), "ark-"));
  mkdirSync(join(dir, ".cursor"));
  writeFileSync(
    join(dir, ".cursor", "agent-runtime.config.json"),
    JSON.stringify({ supabase: { apiPort: 1, dbPort: 2 } }),
  );
  const cfg = loadProjectConfig(dir, { vendor: "default" });
  assert.equal(cfg.supabase.apiPort, 1);
  assert.equal(cfg._meta.legacy, true);
});

test("normalizeConfig still requires ports on merged object", () => {
  assert.throws(() => normalizeConfig({ envDefaults: {} }), /supabase/);
});

test("normalizeConfig applies nodeVersion override and leaves unset optional", () => {
  const withOverride = normalizeConfig({
    supabase: { apiPort: 1, dbPort: 2 },
    nodeVersion: "24.11.0",
  });
  assert.equal(withOverride.nodeVersion, "24.11.0");
  assert.equal(withOverride.pnpmVersion, undefined);

  const bare = normalizeConfig({ supabase: { apiPort: 1, dbPort: 2 } });
  assert.equal(bare.nodeVersion, undefined);
  assert.equal(bare.pnpmVersion, undefined);
});

test("normalizeConfig rejects unsafe nodeVersion", () => {
  assert.throws(
    () => normalizeConfig({ supabase: { apiPort: 1, dbPort: 2 }, nodeVersion: "../evil" }),
    /nodeVersion/,
  );
});
