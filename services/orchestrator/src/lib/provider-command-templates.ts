// Shared default command templates for external provider CLIs.
//
// Only the OpenClaw template is centralised here: it was byte-identical in
// provider-runtime.ts, pulse-prescreen.ts and full-pulse.ts. The codex /
// claude-code templates intentionally differ per call site (quoting rules),
// so they stay inline.
//
// Placeholders ({{repo_root}}, {{prompt_file}}, {{output_file}}) are substituted
// by the caller before spawning.
export const OPENCLAW_DEFAULT_COMMAND_TEMPLATE =
  'node "{{repo_root}}/scripts/openclaw-agent-command.mjs" --prompt-file "{{prompt_file}}" --output-file "{{output_file}}"';
