import assert from "node:assert/strict";
import test from "node:test";
import { builtInLocalDefaults, normalizeConfig } from "../core/config.js";
import { resolveEnvMap, resolveEnvValue } from "../core/env.js";
import { isLocalSupabaseUrl } from "../core/supabase.js";

test("normalizeConfig requires supabase ports", () => {
  assert.throws(() => normalizeConfig({}), /supabase\.apiPort/);
});

test("builtInLocalDefaults uses project ports (not hardcoded 54321)", () => {
  const config = normalizeConfig({
    supabase: { apiPort: 60321, dbPort: 60322 },
  });
  const d = builtInLocalDefaults(config);
  assert.equal(d.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:60321");
  assert.match(d.DATABASE_URL, /60322/);
  assert.doesNotMatch(d.NEXT_PUBLIC_SUPABASE_URL, /54321/);
});

test("resolveEnvValue prefers process env over defaults", () => {
  const config = normalizeConfig({
    supabase: { apiPort: 60321, dbPort: 60322 },
    envDefaults: { SESSION_SECRET: "from-config" },
  });
  assert.equal(resolveEnvValue("SESSION_SECRET", config, {}), "from-config");
  assert.equal(
    resolveEnvValue("SESSION_SECRET", config, { SESSION_SECRET: "from-secret" }),
    "from-secret",
  );
});

test("resolveEnvMap includes Hresale-style keys from envKeys + built-ins", () => {
  const config = normalizeConfig({
    supabase: { apiPort: 60321, dbPort: 60322 },
    envDefaults: {
      SESSION_SECRET: "local-session",
      BOOTSTRAP_ADMIN_EMAIL: "owner@example.com",
    },
    envKeys: [
      "DATABASE_URL",
      "SESSION_SECRET",
      "NEXT_PUBLIC_SUPABASE_URL",
      "BOOTSTRAP_ADMIN_EMAIL",
    ],
  });
  const map = resolveEnvMap(config, {});
  assert.equal(map.SESSION_SECRET, "local-session");
  assert.equal(map.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:60321");
  assert.equal(map.BOOTSTRAP_ADMIN_EMAIL, "owner@example.com");
  assert.match(map.DATABASE_URL, /60322/);
  assert.ok(map.NEXT_PUBLIC_SUPABASE_ANON_KEY);
});

test("isLocalSupabaseUrl", () => {
  assert.equal(isLocalSupabaseUrl("http://127.0.0.1:60321"), true);
  assert.equal(isLocalSupabaseUrl("http://localhost:54321"), true);
  assert.equal(isLocalSupabaseUrl("https://xyz.supabase.co"), false);
});
