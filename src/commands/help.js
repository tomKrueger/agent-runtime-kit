export function cmdHelp() {
  console.log(`agent-runtime — shared cloud/self-hosted workspace runtime

Usage:
  agent-runtime <command>

Commands:
  help                 Show this help
  version              Print package version
  init                 Create root agent-runtime.config.json if missing; refresh adapters
  sync                 Regenerate .cursor/environment.json (etc.) FROM config — never wipes config
  cursor-install       Cursor Cloud Build entry
  cursor-start         Cursor Cloud boot
  prepare              Same bootstrap; pass --vendor=claude|cursor|default

Init flags:
  --refresh / --force  Refresh adapters from config (does NOT overwrite config)
  --force-config       DANGEROUS: replace agent-runtime.config.json from template

Config layering (repo root):
  agent-runtime.config.json                 shared defaults (required)
  agent-runtime.config.cursor.json          optional Cursor overrides
  agent-runtime.config.claude.json          optional Claude overrides

After editing config:
  pnpm exec agent-runtime sync

Install:
  pnpm add github:tomKrueger/agent-runtime-kit#v0.1.1
`);
}
