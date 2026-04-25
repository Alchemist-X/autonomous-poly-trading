# OKX 批量创建多 EVM 账户调研

英文版见 [multi-wallet-register.en.md](multi-wallet-register.en.md)。

最后更新：2026-03-16

## 调研问题

目标问题：

- 如果使用 OKX Wallet，能否一次性创建 `10` 个 EVM 账户？
- 如果可以，这 `10` 个账户是否适合拿来做“地址分组管理”？
- 这些账户能否分别导出私钥，并写入本项目的 `.env.aizen` 一类环境文件？

这份文档只记录调研结论，不执行任何创建、导出或写入动作。

## 结论

结论可以直接概括为：

- `可以` 用 OKX Wallet 一次性批量创建 `10` 个 EVM 账户
- 这条路径 `适合地址分组管理`
- 这条路径 `不适合强隔离风控`
- `可以` 分别导出每个账户的私钥
- `不能确认` 官方存在“一键批量导出 10 个私钥”的能力
- 实际可行流程大概率是：
  - 批量创建 10 个账户
  - 导出 10 个地址列表
  - 逐个账户导出私钥
  - 再人工或脚本写入 `.env.aizen`

## 官方依据

### 1. OKX Wallet 支持批量创建账户

OKX 官方帮助中心明确写到：

- 支持 `Add accounts in bulk`
- 可以一次性创建多个账户
- `最多 99 个`
- Web Extension 和 App 都支持
- 支持 Ethereum、Polygon、BNB Chain 以及其他 EVM 网络相关使用场景

这意味着：

- 批量创建 `10` 个 EVM 账户没有问题
- 从“地址分组管理”的角度看，数量和工具能力都够用

参考：

- https://www.okx.com/en-us/help/how-do-i-create-multiple-accounts-and-send-crypto-to-multiple-accounts

### 2. 这些账户本质上是同一个钱包下的派生账户

OKX 官方钱包管理文档明确提到：

- `Add account` 创建的是 `derived wallet`
- 同一个钱包下新增的账户 `共享同一个 seed phrase`
- 如果钱包是 `private key import` 导入的，则 `不能继续添加账户`

这意味着：

- 如果你是为了“地址分组管理”，这正好符合需求
- 如果你是为了“每个地址彼此完全隔离”，这条路不合适
- 想批量创建 10 个账户，底层前提应该是一个 `seed phrase wallet`

参考：

- https://www.okx.com/en-us/help/how-do-i-manage-my-wallet-web

### 3. OKX 支持按账户查看和导出私钥

OKX 官方关于私钥 / 助记词的帮助文档明确写到：

- 可以进入 `Backups`
- 选择具体的 `wallet-address`
- 再选择具体的 `account`
- 之后查看该账户的 `Private key`

这说明：

- 每个派生账户是可以单独导出私钥的
- 因此“每个账户一个私钥，再写入 env”这件事在技术上可行

但我没有查到官方文档写明：

- 支持一次性导出 10 个账户的全部私钥
- 支持直接导出成 `.env` 或批量密钥文件

因此更稳妥的判断是：

- `单个账户导出私钥` 有官方路径
- `批量导出多个私钥` 没找到官方公开说明

参考：

- https://www.okx.com/en-us/help/what-is-a-private-key-seed-phrase

### 4. 对接 Polymarket 时，这类钱包属于 EOA

Polymarket 官方文档明确说明：

- `signatureType = 0` 对应 EOA
- `funder` 就是该 EOA 自己的地址
- 这类钱包需要自己持有 `USDC.e`
- 如果走 EOA 路线，还需要 `POL` 支付 gas

这意味着：

- OKX Wallet 批量创建出来的这 10 个 EVM 地址，可以作为 10 个独立 EOA 来接 Polymarket
- 每个地址都需要自己准备资金
- 每个地址都可以独立生成或派生自己的 API 凭据

参考：

- https://docs.polymarket.com/trading/quickstart
- https://docs.polymarket.com/developers/proxy-wallet

### 5. 不要把 OKX CEX 子账户和 OKX Wallet 多地址搞混

OKX 还有一个官方概念叫 `sub-account`，这是交易所账号层面的子账户能力。

官方文档描述的 `sub-account`：

- 是 OKX 主账号下面的次级账号
- 用于交易策略分组和风险隔离
- 属于中心化账户体系

这不等于：

- 链上 EVM 地址
- 钱包私钥
- 可直接拿去给 Polymarket CLOB SDK 当 signer 的 EOA

所以如果目标是给本项目生成 10 个可直接签名下单的钱包地址，应该看的是 `OKX Wallet 多账户`，不是 `OKX Exchange 子账户`。

参考：

- https://www.okx.com/en-us/help/what-is-sub-account

## 对“地址分组管理”的适配性判断

如果你的真实目标是：

- 把 10 个地址分组管理
- 每个地址分别持仓
- 每个地址分别记账
- 但不要求这 10 个地址在密钥根上完全隔离

那么 OKX 这条路线是可接受的。

原因：

- 可以批量创建
- 可以下载地址列表
- 同一个钱包里集中管理方便
- 后续给每个地址单独充值、单独使用也比较顺手

## 对“安全隔离”的限制

如果你的真实目标是：

- 每个地址都要做到尽量独立
- 某一个地址泄露时，不要影响另外 9 个地址

那么 OKX 同一个 seed phrase 下派生 10 个账户并不是理想方案。

原因很直接：

- 这些账户共享同一个助记词根
- 一旦助记词泄露，风险会同时扩散到这一组账户

所以：

- `地址分组管理`：适合
- `强安全隔离`：不适合

## 是否适合写入 `.env.aizen`

技术上可行，但需要区分“能用”和“适合生产”。

### 适合的场景

- 本地实验
- 小规模内部测试
- 临时自动化脚本
- 需要快速打通多账户执行验证

### 不适合的场景

- 长期生产
- 多人协作环境
- 真实较大资金管理
- 需要审计、轮换、最小权限控制的环境

原因：

- `.env.aizen` 本质上还是明文密钥文件
- 如果存 10 个账户私钥，泄露面会明显扩大
- 一旦被误传、误备份、误同步，损失风险会放大

更稳妥的建议：

- 开发环境：可以先写 `.env.aizen`
- 生产环境：改用 KMS、Vault 或最少也要拆分密钥存储

## 如果真的落到本项目，建议的数据组织方式

如果后续要接入本项目，不建议只保留一个：

- `PRIVATE_KEY`
- `FUNDER_ADDRESS`

更合适的是改成多账户结构，例如：

```env
WALLET_1_PRIVATE_KEY=0x...
WALLET_1_FUNDER_ADDRESS=0x...
WALLET_1_SIGNATURE_TYPE=0

WALLET_2_PRIVATE_KEY=0x...
WALLET_2_FUNDER_ADDRESS=0x...
WALLET_2_SIGNATURE_TYPE=0
```

或者直接改成一个结构化配置文件，再由 executor 读取。

原因：

- 多账户轮询更清晰
- 风控和日志更好打标签
- 不容易把不同地址的订单、仓位、风险事件混起来

## 当前仓库里的推荐落地流程

当前仓库的 executor 仍然是单钱包模型。

这意味着：

- 它当前只直接读取一套 `PRIVATE_KEY`
- 它当前只直接读取一套 `FUNDER_ADDRESS`
- 因此更稳的落地方式不是“先改主交易链路去同时吃 10 个钱包”
- 而是“先生成 10 份独立 env 文件，再按 `ENV_FILE` 切换运行”

推荐流程：

1. 在 OKX Wallet 中批量创建 `10` 个 EVM derived accounts
2. 逐个导出私钥，整理成一个只保存在本地的 JSON 文件
3. 建议把这个输入文件放在：
   - `runtime-artifacts/local/polymarket-wallets.json`
4. 参考仓库里的示例文件：
   - `scripts/polymarket-wallets.example.json`
5. 用脚本生成 10 份 env：

```bash
pnpm tsx scripts/generate-wallet-envs.ts \
  --input runtime-artifacts/local/polymarket-wallets.json \
  --output-dir .env.wallets
```

脚本会生成：

- `.env.wallets/poly-01.env`
- `.env.wallets/poly-02.env`
- ...
- `.env.wallets/poly-10.env`
- `.env.wallets/manifest.json`

之后就可以按当前单钱包运行方式切换：

```bash
ENV_FILE=.env.wallets/poly-01.env pnpm live:test
ENV_FILE=.env.wallets/poly-02.env pnpm live:test
```

### 这条路径为什么更适合当前仓库

- 不需要先重构 executor 的单钱包主逻辑
- 不会把 10 个私钥长期塞进一个 `.env.aizen`
- 每个地址都有独立 env 文件，更适合后续做轮询、停用、审计和故障隔离

### Polymarket 侧的关键参数建议

对于 OKX 批量创建出来的 EVM 地址，更符合文档的接法通常是：

- `SIGNATURE_TYPE=0`
- `FUNDER_ADDRESS` 使用该 EOA 自己的地址

并且要注意：

- 每个地址都需要自己准备可交易资金
- EOA 路线需要自己支付 gas
- 当前仓库的 executor 在首次使用时会尝试为该钱包 `derive/create API key`
- 但这不等于自动替你完成充值、授权、地区准入或平台侧首单前置动作

### 仍然需要人工完成的步骤

- OKX Wallet 中的批量创建动作
- 每个账户私钥的导出动作
- 确认你的账户状态和所在地区符合 Polymarket 当前规则
- 每个地址的资金准备、gas 准备和必要授权
- 如平台当前仍要求首登或首单前置确认，这些动作也应逐个地址完成

### 不建议的自动化方式

- 不建议做网页层“连续 10 次注册/点击”的脆弱自动化
- 不建议把 10 个私钥长期放在单个共享 env 文件中
- 不建议在没有确认平台规则前，直接把多地址批量投入真实交易

## 推荐结论

如果当前目标就是“地址分组管理”，我的建议是：

1. 可以使用 OKX Wallet 批量创建 10 个 EVM 账户
2. 可以把这些账户当成一组地址池来管理
3. 不建议把它们理解成 10 个完全独立的钱包安全域
4. 不建议长期直接把 10 个私钥都堆在单个 `.env.aizen` 中
5. 如果后续要真正接入本项目，应该先设计多钱包配置结构，再做导入

## 本次调研边界

本次调研没有执行以下动作：

- 没有创建任何新 OKX 账户
- 没有导出任何私钥
- 没有写入任何新的 `.env.aizen`
- 没有向 Polymarket 注册或初始化任何新交易客户端

## 参考资料

- OKX Wallet 批量创建账户
  - https://www.okx.com/en-us/help/how-do-i-create-multiple-accounts-and-send-crypto-to-multiple-accounts
- OKX Wallet 管理与派生账户
  - https://www.okx.com/en-us/help/how-do-i-manage-my-wallet-web
- OKX 私钥 / 助记词说明
  - https://www.okx.com/en-us/help/what-is-a-private-key-seed-phrase
- OKX 子账户说明
  - https://www.okx.com/en-us/help/what-is-sub-account
- Polymarket Quickstart
  - https://docs.polymarket.com/trading/quickstart
- Polymarket Authentication / Proxy Wallet
  - https://docs.polymarket.com/developers/proxy-wallet
