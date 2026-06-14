#!/usr/bin/env bash
#
# Daily World Cup results refresh + publish — the unattended job behind the
# launchd schedule `com.predict-raven.wc-results`.
#
# Flow:
#   1. pnpm wc:results   re-read Polymarket *settlement* (settled winner + final
#                        score only — market-blind, no prices) into
#                        apps/web/lib/world-cup/generated/results.generated.json.
#                        Credential-free; safe to run any day.
#   2. deploy-web.sh     rebuild (SSG) + ship to forecasting-agent.com — ONLY if a
#                        Vercel credential is present. Per repo §6 we never degrade
#                        silently: with no credential it logs a loud WARN (data is
#                        still refreshed locally); a deploy *failure* exits non-zero.
#
# Install / inspect / disable the schedule: deploy/world-cup-results.cron.example
#
# Manual run:   bash scripts/world-cup/daily-results.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# launchd / cron start with a minimal PATH — pin Homebrew (node, pnpm, vercel) first.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ts()  { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { echo "$(ts) [wc-daily] $*"; }

log "=== start (mode=live · source=polymarket-settlement) ==="
log "repo=$REPO_ROOT  node=$(node -v 2>/dev/null || echo '?')  pnpm=$(pnpm -v 2>/dev/null || echo '?')"

# 1) Refresh settled results.
if ! pnpm wc:results; then
  log "ERR  pnpm wc:results failed — aborting; page data left unchanged."
  exit 1
fi

# 2) Publish — only with a working Vercel credential.
if [[ -n "${VERCEL_TOKEN:-}" ]] || vercel whoami >/dev/null 2>&1; then
  log "deploying to production (forecasting-agent.com) ..."
  if bash scripts/world-cup/deploy-web.sh; then
    log "OK   deployed to production."
  else
    log "ERR  deploy-web.sh failed — results refreshed locally but NOT published."
    exit 2
  fi
else
  log "WARN no Vercel credential found (run 'vercel login' once, or export VERCEL_TOKEN)."
  log "WARN results were refreshed locally but the deploy step was SKIPPED — site not updated."
fi

log "=== done ==="
