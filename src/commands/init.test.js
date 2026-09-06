import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { deriveEnvironmentName } from "./init.js";

test("deriveEnvironmentName strips _web_nextjs and adds -dev", () => {
  const dir = mkdtempSync(join(tmpdir(), "ark-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "hresalehub_web_nextjs" }));
  assert.equal(deriveEnvironmentName(dir), "hresalehub-dev");
});

test("deriveEnvironmentName uses unscoped package name", () => {
  const dir = mkdtempSync(join(tmpdir(), "ark-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "@acme/job-seeker-saas" }));
  assert.equal(deriveEnvironmentName(dir), "job-seeker-dev");
});

test("deriveEnvironmentName falls back to directory", () => {
  const parent = mkdtempSync(join(tmpdir(), "ark-"));
  const dir = join(parent, "my_cool_app_web_nextjs");
  mkdirSync(dir);
  assert.equal(deriveEnvironmentName(dir), "my-cool-app-dev");
});
