# Agentic Wallet Fast Setup SOP

> Chinese version: [`docs/agentic-wallet-setup.md`](../agentic-wallet-setup.md)
>
> Last updated: 2026-05-05

Use this SOP when a new operator needs the fastest Raven setup through OnchainOS / AW. The target shape is: OnchainOS provides login and signing; the Polymarket proxy/deposit wallet holds funds and positions.

## Recommended Path

- **Default provider**: `WALLET_PROVIDER=onchainos`. Private keys stay out of `.env`; Raven signs EIP-712 through the local OnchainOS session.
- **Funds address**: set `FUNDER_ADDRESS` to the proxy/deposit wallet shown in the Polymarket profile dropdown. That is the address with pUSD and positions.
- **Signature type**: use `SIGNATURE_TYPE=3` (`POLY_1271`) for the new deposit-wallet flow; use `0` only for standalone EOAs; use `1` / `2` only for legacy Polymarket proxy/safe paths.
- **Legacy alias**: `WALLET_PROVIDER=okx-agentic` still works, but new docs and env files should use `onchainos`.

## 0. Do Not Trade First

Every live command can move real money. For first setup, run only:

```bash
ENV_FILE=.env.aw-live pnpm poly:aw:check -- --json
```

Only after check prints the expected signer / funder / signatureType / balance should you run the `$5` smoke:

```bash
ENV_FILE=.env.aw-live pnpm poly:aw:trade -- --json --max-usd 5
```

## 1. Log Into OnchainOS

```bash
onchainos wallet status
onchainos wallet login <email>
onchainos wallet verify <otp>
onchainos wallet balance
```

Manual checks:

- `wallet status` must be logged in.
- `wallet balance` must show the active EVM address you expect to use as the AW signer.
- If the active account is wrong, switch accounts in OnchainOS before continuing.

## 2. Find The Polymarket Funds Address

Open the Polymarket profile / wallet dropdown and copy the proxy/deposit wallet address. Do not put the active AW EOA into `FUNDER_ADDRESS` unless that EOA is intentionally the standalone funds account.

If unsure, check:

```bash
curl "https://gamma-api.polymarket.com/public-profile?address=<ACTIVE_AW_EOA>"
```

If the response has `proxyWallet`, use that as `FUNDER_ADDRESS`.

Verified current behavior: OnchainOS gives Raven a signing EOA; it does not automatically deploy or fund the Polymarket deposit wallet. The official `@polymarket/builder-relayer-client` can derive the deposit wallet address from the EOA, but an undeployed wallet with zero pUSD still cannot trade. Use a Relayer API Key or the Polymarket UI / official deposit flow to actually deploy and fund it.

## 3. Write `.env.aw-live`

Copy from `.env.example`. Minimal fields:

```bash
AUTOPOLY_EXECUTION_MODE=live
WALLET_PROVIDER=onchainos
ONCHAINOS_BIN=onchainos
PRIVATE_KEY=
FUNDER_ADDRESS=0x...      # Polymarket deposit wallet
SIGNATURE_TYPE=3
CHAIN_ID=137
POLYMARKET_HOST=https://clob.polymarket.com
INITIAL_BANKROLL_USD=20
MAX_TRADE_PCT=0.1
MAX_EVENT_EXPOSURE_PCT=0.3
MIN_TRADE_USD=5
```

## 4. Run Setup Validation

```bash
ENV_FILE=.env.aw-live pnpm poly:aw:check -- --json
```

Required output:

- `walletProvider` is `onchainos`
- `walletMode` is `proxy`
- `signatureType` is `3`, or the explicit legacy `1` / `2` you selected
- `signerAddressPreview` is the OnchainOS active EOA
- `funderAddressPreview` is the Polymarket proxy/deposit wallet
- balance is above 0, or the zero balance is clearly explained

## 5. Minimal Live Smoke

```bash
ENV_FILE=.env.aw-live pnpm poly:aw:trade -- --json --max-usd 5
```

Result handling:

- If `/order` is accepted, AW setup is complete.
- If it returns `maker address not allowed, please use the deposit wallet flow`, first check that `FUNDER_ADDRESS` is a deployed, funded Polymarket deposit wallet and `SIGNATURE_TYPE` is `3`.
- If it returns a regional restriction, rerun from an officially supported Polymarket region/network; do not restart OTP, API-key, deposit, or allowance debugging.

## Jentake / Turnkey Provider Slot

If Jentake / Turnkey is added later, do not change the trading path. The provider should still resolve the same fields: `signerAddress`, `funderAddress`, `signatureType`, and `walletMode`. Raven executor only needs that Polymarket signing identity.

The implemented and tested path today is OnchainOS. Jentake / Turnkey should be added as another provider behind the same wallet-provider abstraction.
