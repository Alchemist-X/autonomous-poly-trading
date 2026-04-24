// Local-only smoke script for V2 SDK migration verification.
// Reads collateral (pUSD post-cutover) balance + allowance for the configured wallet.
// Usage: ENV_FILE=/tmp/no1-v2.env pnpm exec tsx scripts/v2-smoke-balance.ts
// Delete after smoke is done.

import { loadConfig } from "../services/executor/src/config.ts";
import { getCollateralBalanceAllowance } from "../services/executor/src/lib/polymarket-sdk.ts";

async function main() {
  const config = loadConfig();
  console.log("ENV_FILE:", config.envFilePath ?? "(default cascade)");
  console.log("host    :", config.polymarketHost);
  console.log("chain   :", config.chainId);
  console.log("sigType :", config.signatureType);
  console.log("funder  :", config.funderAddress.slice(0, 6) + "***" + config.funderAddress.slice(-4));
  console.log("");

  if (!config.privateKey || !config.funderAddress) {
    console.error("Missing PRIVATE_KEY or FUNDER_ADDRESS — cannot init SDK.");
    process.exit(1);
  }

  console.log("Calling getBalanceAllowance({asset_type: 'COLLATERAL'}) ...");
  const t0 = Date.now();
  const result = await getCollateralBalanceAllowance(config);
  const ms = Date.now() - t0;
  console.log(`done in ${ms}ms`);
  console.log("");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("SMOKE ERROR:", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
