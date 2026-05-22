// Local-only smoke script for V2 SDK migration verification.
// Reads collateral (pUSD post-cutover) balance + allowance for the configured wallet.
// Usage: ENV_FILE=/tmp/no1-v2.env pnpm exec tsx scripts/v2-smoke-balance.ts
// Delete after smoke is done.

import { loadConfig } from "../services/executor/src/config.ts";
import {
  getCollateralBalanceAllowance,
  resolvePolymarketSigningIdentity
} from "../services/executor/src/lib/polymarket-sdk.ts";

function maskAddress(address: string) {
  return address ? `${address.slice(0, 6)}***${address.slice(-4)}` : "-";
}

async function main() {
  const config = loadConfig();
  if ((config.walletProvider ?? "private-key") === "private-key" && (!config.privateKey || !config.funderAddress)) {
    console.error("Missing PRIVATE_KEY or FUNDER_ADDRESS — cannot init SDK in private-key mode.");
    process.exit(1);
  }

  const identity = await resolvePolymarketSigningIdentity(config);
  console.log("ENV_FILE:", config.envFilePath ?? "(default cascade)");
  console.log("host    :", config.polymarketHost);
  console.log("chain   :", config.chainId);
  console.log("wallet  :", config.walletProvider ?? "private-key");
  console.log("mode    :", identity.walletMode);
  console.log("sigType :", identity.signatureType);
  console.log("signer  :", maskAddress(identity.signerAddress));
  console.log("funder  :", maskAddress(identity.funderAddress));
  console.log("");

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
