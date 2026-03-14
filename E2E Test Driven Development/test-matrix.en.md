# Test Matrix

Chinese version: [test-matrix.md](test-matrix.md)

## Environment matrix

| Dimension | local-lite | remote-real |
| --- | --- | --- |
| Web pages | yes | yes |
| Admin login | yes | yes |
| fake orchestrator | yes | no |
| Real database | no | yes |
| Real wallet | no | yes |
| Video recording | yes | yes |

## Scenario matrix

| Scenario | local-lite | remote-real |
| --- | --- | --- |
| public-pages-render | yes | yes |
| admin-auth-flow | yes | yes |
| admin-action-proxy | yes | yes |
| mock-run-visibility | yes | no |
| run-persisted-real | no | yes |
| portfolio-sync-real | no | yes |
| failure-video-demo | yes | placeholder |
| success-video-demo | yes | yes |

## Guardrail matrix

| Guardrail | Description |
| --- | --- |
| `AUTOPOLY_E2E_REMOTE=1` | explicitly enables remote-real mode |
| `ALLOW_REAL_TRADING=1` | explicitly allows real trading |
| `MAX_LIVE_TRADE_USD<=1` | max live trade notional |
| allowlisted market slug | only approved markets are allowed |
| destructive cases split out | dangerous actions such as flatten stay out of the default regression set |
