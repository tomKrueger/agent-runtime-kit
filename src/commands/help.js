export function cmdHelp() {
  console.log(`agent-runtime — shared cloud/self-hosted workspace runtime

Usage:
  agent-runtime <command>

Commands:
  help                 Show this help
  version              Print package version
  init                 Scaffold .cursor/agent-runtime.config.json + environment.json
  cursor-install       Cursor Cloud Build entry (ensure runtime + warm Supabase images)
  cursor-start         Cursor Cloud boot (write .env.local, local/hosted Supabase, migrate)
  prepare              Same as cursor-start (generic alias)

Coming later:
  sync, codex-setup, claude-bootstrap, selfhosted-prepare

Install:
  pnpm add github:tomKrueger/agent-runtime-kit#v0.1.0

Consumer contract:
  1. Add dependency + commit .cursor/agent-runtime.config.json (ports, migrateCmd, envKeys)
  2. Point .cursor/environment.json install/start at cursor-install / cursor-start
  3. Rebuild the Cursor Cloud environment
  4. Only then remove legacy .cursor/scripts/cursor-agent/*.sh
`);
}
