#!/usr/bin/env bash
# One-command production deploy for forecasting-agent.com.
# Flow: (optional) re-import forecasts -> local prebuilt vercel build ->
# patch the catch-all rewrite (check:true, see handoff: dynamic-route 404
# platform bug) -> deploy prebuilt to production.
set -euo pipefail
cd "$(dirname "$0")/../.."

export VERCEL_ORG_ID=team_2pB0XDZyHAZM66UPHg0fuAvA
export VERCEL_PROJECT_ID=prj_kPZRCALGVSeotZxQ1PD0fvOOwmRc

if [[ "${1:-}" == "--import" ]]; then
  echo "[1/4] importing forecasts from runtime-artifacts ..."
  pnpm tsx scripts/world-cup/import-predictions.ts
fi

echo "[2/4] vercel build (production) ..."
rm -rf .vercel/output
vercel build --prod > /dev/null

echo "[3/4] patching catch-all rewrite (check:true) ..."
python3 - << 'PY'
import json
p = '.vercel/output/config.json'
c = json.load(open(p))
n = 0
for r in c['routes']:
    if r.get('src') == '^/(?!apps/web/)(.+)$' and 'check' not in r:
        r['check'] = True; n += 1
json.dump(c, open(p, 'w'))
print(f"   patched {n} route(s)")
PY

echo "[4/4] deploying to production ..."
vercel deploy --prebuilt --prod
echo "OK -> https://forecasting-agent.com"
