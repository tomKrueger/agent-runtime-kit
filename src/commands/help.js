export function cmdHelp() {
  console.log(`agent-runtime — shared cloud/self-hosted workspace runtime

Usage:
  agent-runtime <command>

Commands:
  help                 Show this help
  version              Print package version
  init                 Scaffold project config + Cursor templates (phase 0)

Coming in later phases:
  sync                 Refresh templates from this package version
  prepare              setup-env + local/hosted Supabase + migrate
  cursor-install       Cursor Cloud Build (install) entrypoint
  cursor-start         Cursor Cloud boot (start) entrypoint
  codex-setup          OpenAI Codex setup-script entrypoint
  claude-bootstrap     Claude cloud/self-hosted bootstrap
  selfhosted-prepare   Generic self-hosted runner prepare

Install (GitHub tag, no registry server):
  pnpm add github:tomKrueger/agent-runtime-kit#v0.0.2
`);
}
