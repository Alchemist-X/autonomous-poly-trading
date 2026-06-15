# Agentic Wallet 最快 Setup SOP

> 英文版：[`docs/en/agentic-wallet-setup.md`](en/agentic-wallet-setup.md)
>
> 最后更新：2026-05-05

这份 SOP 给新接手的人用：目标是用 OnchainOS / AW 作为登录与签名层，用 Polymarket proxy/deposit wallet 作为资金层，最快完成 Raven 实盘 setup。

## 推荐路径

- **首选**：`WALLET_PROVIDER=onchainos`。私钥不进 `.env`，Raven 通过本机 OnchainOS session 签 EIP-712。
- **资金地址**：`FUNDER_ADDRESS` 填 Polymarket profile 下拉里显示的 proxy/deposit wallet 地址；这是有 pUSD 和持仓的地址。
- **签名类型**：新 deposit wallet flow 用 `SIGNATURE_TYPE=3`（`POLY_1271`）；只有 standalone EOA 直连才用 `0`；旧 Polymarket proxy/safe 路径才考虑 `1` / `2`。
- **兼容别名**：`WALLET_PROVIDER=okx-agentic` 仍可用，但新文档和新 env 一律写 `onchainos`。

## 0. 不要先下单

所有 live 命令都会动真钱。第一次 setup 只跑：

```bash
ENV_FILE=.env.aw-live pnpm poly:aw:check -- --json
```

只有 check 能打印正确 signer / funder / signatureType / balance 后，才允许跑 `$5` smoke：

```bash
ENV_FILE=.env.aw-live pnpm poly:aw:trade -- --json --max-usd 5
```

## 1. 登录 OnchainOS

```bash
onchainos wallet status
onchainos wallet login <email>
onchainos wallet verify <otp>
onchainos wallet balance
```

人工核对：

- `wallet status` 必须是 logged in。
- `wallet balance` 里 active EVM address 必须是准备用来签名的 AW 地址。
- 如果 active account 不对，先在 OnchainOS 里切账户，再继续。

## 2. 找 Polymarket 资金地址

打开 Polymarket profile / wallet 下拉，复制 proxy/deposit wallet 地址。不要把 active AW EOA 地址误填成 `FUNDER_ADDRESS`，除非这就是 standalone EOA 资金账户。

如果不确定，先查：

```bash
curl "https://gamma-api.polymarket.com/public-profile?address=<ACTIVE_AW_EOA>"
```

返回里有 `proxyWallet` 时，优先用它做 `FUNDER_ADDRESS`。

当前已验证：OnchainOS 只能给 Raven 一个签名 EOA；它不会自动把 Polymarket deposit wallet 部署好。可以用 Polymarket 官方 `@polymarket/builder-relayer-client` 从 EOA 推导 deposit wallet 地址，但地址未部署、余额为 0 时仍不能下单。需要 Relayer API Key 或 Polymarket UI/官方 deposit flow 把资金真正放到 deposit wallet。

## 3. 写 `.env.aw-live`

从 `.env.example` 复制，最小字段如下：

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

## 4. 跑 setup 验证

```bash
ENV_FILE=.env.aw-live pnpm poly:aw:check -- --json
```

必须看到：

- `walletProvider` 是 `onchainos`
- `walletMode` 是 `proxy`
- `signatureType` 是 `3`（或你明确选择的旧 `1` / `2`）
- `signerAddressPreview` 是 OnchainOS active EOA
- `funderAddressPreview` 是 Polymarket proxy/deposit wallet
- balance 大于 0，或至少能清楚解释为什么是 0

## 5. 最小实盘 smoke

```bash
ENV_FILE=.env.aw-live pnpm poly:aw:trade -- --json --max-usd 5
```

结果判断：

- 如果 `/order` 接受，AW setup 完成。
- 如果返回 `maker address not allowed, please use the deposit wallet flow`，优先检查 `FUNDER_ADDRESS` 是否是已部署且有余额的 Polymarket deposit wallet，以及 `SIGNATURE_TYPE` 是否是 `3`。
- 如果返回地区限制，换到 Polymarket 官方支持地区网络再重跑；不要重新排查 OTP、API key、入金和 allowance。

## Jentake / Turnkey 方案位

如果后续接 Jentake / Turnkey，目标接口不要改交易主链路：仍然输出同一组值 `signerAddress`、`funderAddress`、`signatureType`、`walletMode`。Raven executor 只关心这组 Polymarket signing identity。

当前已落地并测试的是 OnchainOS 路径；Jentake / Turnkey 应作为同一 wallet-provider 抽象下的新 provider 接入。
