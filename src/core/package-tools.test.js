import assert from "node:assert/strict";
import test from "node:test";
import {
  NODE_MAJOR_PINS,
  resolveImageToolVersions,
  resolveNodeVersionFromEngines,
  resolveNodeVersionFromNvmFiles,
  resolvePnpmVersionFromPackageManager,
  versionsFromPackageJson,
} from "./package-tools.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_NODE_VERSION, DEFAULT_PNPM_VERSION } from "./config.js";

test("resolveNodeVersionFromEngines handles exact, major, and ranges", () => {
  assert.equal(resolveNodeVersionFromEngines("22.22.2"), "22.22.2");
  assert.equal(resolveNodeVersionFromEngines("24"), NODE_MAJOR_PINS[24]);
  assert.equal(resolveNodeVersionFromEngines("24.x"), NODE_MAJOR_PINS[24]);
  assert.equal(resolveNodeVersionFromEngines("^22.14.0"), NODE_MAJOR_PINS[22]);
  assert.equal(resolveNodeVersionFromEngines(">=20"), NODE_MAJOR_PINS[20]);
  assert.equal(resolveNodeVersionFromEngines("nonsense"), null);
});

test("resolvePnpmVersionFromPackageManager parses Corepack field", () => {
  assert.equal(resolvePnpmVersionFromPackageManager("pnpm@10.33.2"), "10.33.2");
  assert.equal(resolvePnpmVersionFromPackageManager("npm@10.9.0"), null);
});

test("versionsFromPackageJson reads gritgoat-style engines and hresale-style packageManager", () => {
  assert.deepEqual(versionsFromPackageJson({ engines: { node: "24.x" } }), {
    nodeVersion: NODE_MAJOR_PINS[24],
  });
  assert.deepEqual(versionsFromPackageJson({ packageManager: "pnpm@10.33.2" }), {
    pnpmVersion: "10.33.2",
  });
});

test("resolveImageToolVersions prefers config, then nvmrc, then package.json, then defaults", () => {
  const dir = mkdtempSync(join(tmpdir(), "ark-pkg-"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      engines: { node: "20.x" },
      packageManager: "pnpm@10.15.0",
    }),
  );
  writeFileSync(join(dir, ".nvmrc"), "24\n");

  const fromNvm = resolveImageToolVersions(dir, {});
  assert.equal(fromNvm.nodeVersion, NODE_MAJOR_PINS[24]);
  assert.equal(fromNvm.pnpmVersion, "10.15.0");
  assert.match(fromNvm.sources.join(" "), /\.nvmrc/);

  const fromConfig = resolveImageToolVersions(dir, { nodeVersion: "22.22.2", pnpmVersion: "10.33.2" });
  assert.equal(fromConfig.nodeVersion, "22.22.2");
  assert.equal(fromConfig.pnpmVersion, "10.33.2");

  const empty = mkdtempSync(join(tmpdir(), "ark-pkg-"));
  writeFileSync(join(empty, "package.json"), "{}");
  const defaults = resolveImageToolVersions(empty, {});
  assert.equal(defaults.nodeVersion, DEFAULT_NODE_VERSION);
  assert.equal(defaults.pnpmVersion, DEFAULT_PNPM_VERSION);
});

test("resolveNodeVersionFromNvmFiles reads .nvmrc and .node-version", () => {
  const dir = mkdtempSync(join(tmpdir(), "ark-nvm-"));
  writeFileSync(join(dir, ".nvmrc"), "v22.22.2\n");
  assert.deepEqual(resolveNodeVersionFromNvmFiles(dir), {
    version: "22.22.2",
    source: ".nvmrc",
  });

  const dir2 = mkdtempSync(join(tmpdir(), "ark-nvm-"));
  writeFileSync(join(dir2, ".node-version"), "24\n");
  assert.deepEqual(resolveNodeVersionFromNvmFiles(dir2), {
    version: NODE_MAJOR_PINS[24],
    source: ".node-version",
  });
});
