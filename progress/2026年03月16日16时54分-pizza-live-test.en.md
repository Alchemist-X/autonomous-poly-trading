# 2026-03-16 16:54 Pizza Live Test Progress

## Goal

- Start a real-fund test preparation run with the `pizza` wallet
- Verify wallet connectivity, balance recognition, and the `live:test` automation path
- Record which autonomous steps actually ran and where the flow stopped

## What Ran

1. Created a dedicated live env file:
   - Path: `.env.live-test`
   - Key settings:
     - `AUTOPOLY_EXECUTION_MODE=live`
     - `INITIAL_BANKROLL_USD=20`
     - `MAX_TRADE_PCT=0.1`
     - `MAX_EVENT_EXPOSURE_PCT=0.3`
     - `FUNDER_ADDRESS` set to `pizza`

2. Ran a read-only wallet check:

```bash
ENV_FILE=/Users/Aincrad/dev-proj/autonomous-poly-trading/.env.live-test \
pnpm --filter @autopoly/executor ops:check -- --json
```

3. Ran the full automated live test:

```bash
ENV_FILE=.env.live-test pnpm live:test -- --json
```

## Results

### 1. Pizza wallet connectivity is valid

`ops:check` successfully returned:

- `envFilePath`: `/Users/Aincrad/dev-proj/autonomous-poly-trading/.env.live-test`
- `funderAddressPreview`: `0x9938***8250`
- a readable CLOB order book
- a valid candidate market

This means:

- the `pizza` private key and address are valid
- the Polymarket client can initialize
- the read-only market inspection path works

### 2. Polymarket still sees zero tradable USDC balance

`ops:check` returned:

- `usdcBalance = 0`

I also queried the raw CLOB `balance-allowance` response directly, and it returned:

```json
{
  "balance": "0",
  "allowances": {
    "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E": "0",
    "0xC5d563A36AE78145C45a50134d48A1215220f80a": "0",
    "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296": "0"
  }
}
```

At least one of these is still true:

- the wallet does not yet hold tradable USDC collateral recognized by Polymarket
- the funds have not been finalized through the official deposit / bridge path
- only gas assets were funded, not order collateral

Conclusion:

- `pizza has money` does not yet mean `pizza is ready to trade`

### 3. The automated live flow never reached recommendation

`live:test` failed with:

- `message`: `Failed query: select 1`
- archive dir:
  - `runtime-artifacts/live-test/2026-03-16T085359Z-pending`
- error file:
  - `runtime-artifacts/live-test/2026-03-16T085359Z-pending/error.json`

The flow stopped during the initial database health check.

## Autonomous Flow Definition

The current `pnpm live:test` flow is:

1. Load the dedicated env file
2. Run preflight
   - live mode check
   - private key and funder address check
   - database check
   - Redis check
   - Polymarket client check
   - remote position emptiness check
   - local DB open-position check
   - bankroll and risk parameter checks
3. Initialize portfolio state
4. Run recommendation
5. Queue and execute trades sequentially
6. Run sync
7. Emit summary and archive outputs

## Where This Run Stopped

This run only reached:

1. env loading
2. the database health check inside preflight

It did not reach:

- recommendation
- queue execution
- sync
- successful summary

## Current Blockers

### Blocker 1: Local PostgreSQL is not available

The default database target is currently unavailable:

- `postgres://postgres:postgres@localhost:5432/autopoly`

### Blocker 2: Local Redis is not available

Earlier probing also failed to reach Redis, so even with DB fixed, Redis would still block preflight.

### Blocker 3: Pizza still has zero tradable USDC balance

Even if DB and Redis were fixed, the current `ops:check` result still shows:

- `pizza` does not yet have available Polymarket trading collateral
- the raw CLOB `collateral balance` and `allowances` are also `0`

## What Did Not Happen

- no live recommendation run was created
- no real order was submitted
- no real fill occurred
- no remote position was changed

## Recommended Next Steps

1. Start PostgreSQL and Redis locally, or provide working remote `DATABASE_URL` / `REDIS_URL`
2. Confirm the `pizza` wallet holds Polymarket-recognized USDC collateral, not only native gas assets
3. Rerun:

```bash
ENV_FILE=/Users/Aincrad/dev-proj/autonomous-poly-trading/.env.live-test \
pnpm --filter @autopoly/executor ops:check -- --json

ENV_FILE=/Users/Aincrad/dev-proj/autonomous-poly-trading/.env.live-test \
pnpm live:test -- --json
```

## Conclusion

This was not a strategy failure or execution-logic failure. The live-fund prerequisites are still incomplete.

Current state:

- `pizza` wallet identity is valid
- the Polymarket read-only check path works
- the automated live entrypoint is ready
- but database, Redis, and tradable USDC collateral are not yet in place
