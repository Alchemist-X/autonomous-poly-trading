#!/bin/zsh
# Open an interactive Claude Code session (real TTY) so the /workflows panel renders.
# The desktop app drives Claude Code over stream-json (non-interactive), where /workflows
# (a local-jsx terminal panel) is filtered out. A real terminal is interactive, so it works.
cd "/Users/Aincrad/dev-proj/predict-raven" || exit 1
echo "Starting Claude Code in interactive mode. Type /workflows once it loads."
exec claude
