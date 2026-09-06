import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DEFAULT_NODE_VERSION } from "../core/config.js";
import { stampDockerfileArg, syncCursorDockerfile, syncCursorEnvironment } from "./sync.js";

function writeMinimalConfig(dir, extra = {}) {
  writeFileSync(
    join(dir, "agent-runtime.config.json"),
    `${JSON.stringify(
      {
        environmentName: "demo-dev",
        packageManager: "pnpm",
        supabase: { apiPort: 60321, dbPort: 60322, studioPort: 60323 },
        ...extra,
      },
      null,
      2,
    )}\n`,
  );
}

test("syncCursorDockerfile stamps default Node version", () => {
  const dir = mkdtempSync(join(tmpdir(), "ark-sync-"));
  writeMinimalConfig(dir);
  syncCursorDockerfile(dir);
  const dest = join(dir, ".cursor", "Dockerfile");
  assert.equal(existsSync(dest), true);
  const body = readFileSync(dest, "utf8");
  assert.match(body, /FROM ubuntu:24\.04/);
  assert.match(body, new RegExp(`ARG NODE_VERSION=${DEFAULT_NODE_VERSION}`));
  assert.match(body, /fuse-overlayfs/);
});

test("syncCursorDockerfile stamps Node from package.json engines", () => {
  const dir = mkdtempSync(join(tmpdir(), "ark-sync-"));
  writeMinimalConfig(dir);
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "demo", engines: { node: "24.x" }, packageManager: "pnpm@10.15.0" }),
  );
  syncCursorDockerfile(dir);
  const body = readFileSync(join(dir, ".cursor", "Dockerfile"), "utf8");
  assert.match(body, /ARG NODE_VERSION=24\./);
  assert.match(body, /ARG PNPM_VERSION=10\.15\.0/);
});

test("syncCursorDockerfile uses nodeVersion from consumer config over package.json", () => {
  const dir = mkdtempSync(join(tmpdir(), "ark-sync-"));
  writeMinimalConfig(dir, { nodeVersion: "22.22.2", pnpmVersion: "10.33.2" });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ engines: { node: "24.x" }, packageManager: "pnpm@10.15.0" }),
  );
  syncCursorDockerfile(dir);
  const body = readFileSync(join(dir, ".cursor", "Dockerfile"), "utf8");
  assert.match(body, /ARG NODE_VERSION=22\.22\.2/);
  assert.match(body, /ARG PNPM_VERSION=10\.33\.2/);
});

test("stampDockerfileArg replaces only the ARG line", () => {
  const out = stampDockerfileArg(
    "ARG NODE_VERSION=1.0.0\nRUN echo $NODE_VERSION\n",
    "NODE_VERSION",
    "24.0.0",
  );
  assert.equal(out, "ARG NODE_VERSION=24.0.0\nRUN echo $NODE_VERSION\n");
});

test("syncCursorEnvironment writes Dockerfile and points build at it", () => {
  const dir = mkdtempSync(join(tmpdir(), "ark-sync-"));
  writeMinimalConfig(dir);
  syncCursorEnvironment(dir);

  const dockerfile = join(dir, ".cursor", "Dockerfile");
  const envJson = join(dir, ".cursor", "environment.json");
  assert.equal(existsSync(dockerfile), true);
  assert.equal(existsSync(envJson), true);

  const env = JSON.parse(readFileSync(envJson, "utf8"));
  assert.deepEqual(env.build, { dockerfile: "Dockerfile", context: ".." });
  assert.equal(env.name, "demo-dev");
  assert.match(env.install, /agent-runtime cursor-install/);
  assert.match(env.start, /agent-runtime cursor-start/);
  assert.equal(env.ports.find((p) => p.name === "supabase-api")?.port, 60321);
});
