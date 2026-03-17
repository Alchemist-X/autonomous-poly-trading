# OKX Multi-EVM Account Research

Chinese version: [multi-wallet-register.md](multi-wallet-register.md)

Last updated: 2026-03-16

## Research questions

The goal of this note is to answer:

- If OKX Wallet is used, can it create `10` EVM accounts in bulk?
- If yes, are those `10` accounts suitable for address-group management?
- Can those accounts export individual private keys and later be written into a project env file such as `.env.aizen`?

This note records research findings only. It does not execute any creation, export, or write operation.

## Conclusion

The short conclusion is:

- `yes`, OKX Wallet can create `10` EVM accounts in bulk
- this path `fits address-group management`
- this path `does not fit strong isolation`
- `yes`, each account can export its own private key
- `not confirmed`, there is no official evidence of one-click bulk export for all 10 private keys
- the practical workflow is likely:
  - create 10 accounts in bulk
  - export the address list
  - export each private key one by one
  - then write them manually or programmatically into `.env.aizen`

## Official basis

### 1. OKX Wallet supports bulk account creation

The OKX help center explicitly states that:

- it supports `Add accounts in bulk`
- multiple accounts can be created at once
- up to `99` accounts are supported
- both Web Extension and App support this flow
- it applies to Ethereum, Polygon, BNB Chain, and related EVM usage

This means:

- creating `10` EVM accounts in bulk is not a problem
- from an address-group management perspective, the capability is sufficient

Reference:

- https://www.okx.com/en-us/help/how-do-i-create-multiple-accounts-and-send-crypto-to-multiple-accounts

### 2. These accounts are derived accounts under the same wallet

The OKX wallet management documentation states that:

- `Add account` creates a `derived wallet`
- newly added accounts under the same wallet share the same seed phrase
- wallets imported by `private key` cannot continue adding accounts

This means:

- if the goal is address-group management, this is aligned with the requirement
- if the goal is full isolation between addresses, this route is not ideal
- creating 10 accounts in bulk requires a seed-phrase-based wallet

Reference:

- https://www.okx.com/en-us/help/how-do-i-manage-my-wallet-web

### 3. OKX supports per-account private-key export

The official OKX help documentation for private keys and seed phrases states that a user can:

- go to `Backups`
- choose a specific `wallet-address`
- choose a specific `account`
- then view that account's `Private key`

This means:

- each derived account can export a private key individually
- therefore, storing one private key per account in an env file is technically possible

However, no official public documentation was found that states:

- all 10 account private keys can be exported in one batch
- the result can be exported directly as an `.env` or equivalent multi-key file

So the safer conclusion is:

- `single-account private-key export` is officially supported
- `bulk export of multiple private keys` is not confirmed in public docs

Reference:

- https://www.okx.com/en-us/help/what-is-a-private-key-seed-phrase

### 4. For Polymarket, these wallets behave as EOAs

The Polymarket documentation makes clear that:

- `signatureType = 0` corresponds to an EOA
- `funder` is the EOA address itself
- the wallet needs its own `USDC.e`
- an EOA flow also needs `POL` for gas

This means:

- the 10 EVM addresses created by OKX Wallet can be used as 10 separate EOAs for Polymarket
- each address needs its own funds
- each address can generate or derive its own API credentials independently

Reference:

- https://docs.polymarket.com/trading/quickstart
- https://docs.polymarket.com/developers/proxy-wallet

### 5. Do not confuse OKX exchange sub-accounts with OKX Wallet multi-address support

OKX also has an official concept called `sub-account`, but that belongs to the exchange-account layer.

According to the OKX documentation, a sub-account:

- is a secondary account under an OKX main account
- is used for strategy grouping and exchange-side risk management
- belongs to a centralized account system

It is not the same thing as:

- an on-chain EVM address
- a wallet private key
- an EOA signer usable directly by the Polymarket CLOB SDK

So if the goal is to produce 10 signer wallets for this project, the relevant feature is `OKX Wallet multi-account`, not `OKX Exchange sub-account`.

Reference:

- https://www.okx.com/en-us/help/what-is-sub-account

## Fit for address-group management

If the real goal is:

- managing 10 addresses as a group
- holding positions separately per address
- tracking bookkeeping separately per address
- without requiring strong cryptographic isolation between all 10

then the OKX route is acceptable.

Reasons:

- bulk creation is supported
- the address list can be exported
- centralized management inside one wallet is convenient
- separate funding and usage per address is still straightforward

## Limitations for strong isolation

If the real goal is:

- strong isolation per address
- a compromise of one address should not endanger the other 9

then 10 accounts derived from one OKX seed phrase are not ideal.

The reason is simple:

- they share the same seed root
- if that seed phrase is compromised, the whole group is at risk

So the fit is:

- `address-group management`: suitable
- `strong security isolation`: not suitable

## Whether this should be stored in `.env.aizen`

It is technically feasible, but there is a difference between `possible` and `production-appropriate`.

### Reasonable use cases

- local experiments
- small internal testing
- temporary automation scripts
- quick validation of multi-account execution

### Poor use cases

- long-term production
- multi-user collaboration environments
- larger real-fund operations
- environments that need auditing, rotation, and strict least-privilege controls

Reason:

- `.env.aizen` is still a plaintext secret file
- storing 10 private keys in one place widens the blast radius
- accidental sync, backup, or exposure becomes more damaging

A more robust recommendation is:

- development: `.env.aizen` is acceptable
- production: use KMS, Vault, or at least split secret storage more carefully

## Recommended data shape for this project

If this is eventually integrated into the project, it would be better not to keep only:

- `PRIVATE_KEY`
- `FUNDER_ADDRESS`

A multi-wallet structure is clearer, for example:

```env
WALLET_1_PRIVATE_KEY=0x...
WALLET_1_FUNDER_ADDRESS=0x...
WALLET_1_SIGNATURE_TYPE=0

WALLET_2_PRIVATE_KEY=0x...
WALLET_2_FUNDER_ADDRESS=0x...
WALLET_2_SIGNATURE_TYPE=0
```

Or use a structured configuration file and let the executor load it explicitly.

Reasons:

- clearer wallet rotation and scheduling
- better tagging in risk and logs
- lower chance of mixing orders, positions, and risk events across addresses

## Recommended repository workflow

The current executor is still a single-wallet runtime.

That means:

- it directly reads only one `PRIVATE_KEY`
- it directly reads only one `FUNDER_ADDRESS`
- so the safer implementation path is not “teach the trading runtime to ingest 10 wallets first”
- it is “generate 10 separate env files first, then switch with `ENV_FILE`”

Recommended workflow:

1. create `10` EVM derived accounts in bulk inside OKX Wallet
2. export the private key for each account
3. put them into a local-only JSON file
4. the suggested local path is:
   - `runtime-artifacts/local/polymarket-wallets.json`
5. use the committed example file as the shape reference:
   - `scripts/polymarket-wallets.example.json`
6. generate one env file per wallet:

```bash
pnpm tsx scripts/generate-wallet-envs.ts \
  --input runtime-artifacts/local/polymarket-wallets.json \
  --output-dir .env.wallets
```

The script writes:

- `.env.wallets/poly-01.env`
- `.env.wallets/poly-02.env`
- ...
- `.env.wallets/poly-10.env`
- `.env.wallets/manifest.json`

Then you can run the existing single-wallet flow by switching `ENV_FILE`:

```bash
ENV_FILE=.env.wallets/poly-01.env pnpm live:test
ENV_FILE=.env.wallets/poly-02.env pnpm live:test
```

### Why this fits the current repository better

- no immediate executor refactor is required
- the 10 private keys do not have to live in one shared `.env.aizen`
- one env file per address is cleaner for rotation, disabling, auditing, and fault isolation

### Key Polymarket parameters

For OKX-derived EVM addresses, the more natural Polymarket integration is usually:

- `SIGNATURE_TYPE=0`
- `FUNDER_ADDRESS` set to the EOA itself

Also note:

- each address needs its own trading funds
- the EOA path pays its own gas
- this repository's executor already attempts to `derive/create API key` on first use
- that still does not replace funding, approvals, regional eligibility, or platform-side first-use steps

### Steps that still need manual handling

- bulk creation inside OKX Wallet
- private-key export for each account
- confirming that your account status and region are eligible under the current Polymarket rules
- funding, gas setup, and any required approvals per address
- any first-login or first-trade confirmation that the platform may still require per address

### Automation that is not recommended

- brittle web automation for “click through registration 10 times”
- long-term storage of all 10 private keys in one shared env file
- deploying the whole wallet batch into real trading before the platform rules are confirmed

## Recommendation

If the immediate goal is address-group management, the practical recommendation is:

1. use OKX Wallet to create 10 EVM accounts in bulk
2. treat them as one grouped address pool
3. do not treat them as 10 fully isolated security domains
4. do not keep all 10 private keys in a single `.env.aizen` for long-term production
5. design a proper multi-wallet configuration format before integrating them into this project

## Scope of this research

This research did not perform any of the following:

- no new OKX accounts were created
- no private keys were exported
- no new `.env.aizen` values were written
- no new Polymarket client was initialized or registered

## References

- OKX Wallet bulk account creation
  - https://www.okx.com/en-us/help/how-do-i-create-multiple-accounts-and-send-crypto-to-multiple-accounts
- OKX Wallet management and derived accounts
  - https://www.okx.com/en-us/help/how-do-i-manage-my-wallet-web
- OKX private key and seed phrase documentation
  - https://www.okx.com/en-us/help/what-is-a-private-key-seed-phrase
- OKX sub-account documentation
  - https://www.okx.com/en-us/help/what-is-sub-account
- Polymarket Quickstart
  - https://docs.polymarket.com/trading/quickstart
- Polymarket Authentication and Proxy Wallet
  - https://docs.polymarket.com/developers/proxy-wallet
