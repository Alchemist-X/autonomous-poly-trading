export const LIVE_TEST_BANKROLL_USD = 20;
export const LIVE_TEST_MAX_TRADE_PCT = 0.1;
export const LIVE_TEST_MAX_EVENT_EXPOSURE_PCT = 0.3;

export interface LiveTestPreflightInput {
  executionMode: string;
  envFilePath: string | null;
  hasPrivateKey: boolean;
  hasFunderAddress: boolean;
  dbOk: boolean;
  redisOk: boolean;
  clobOk: boolean;
  remotePositionCount: number;
  localOpenPositionCount: number;
  initialBankrollUsd: number;
  maxTradePct: number;
  maxEventExposurePct: number;
  usdcBalance: number;
}

export interface LiveTestPreflightReport {
  ok: boolean;
  checks: Array<{
    key: string;
    ok: boolean;
    detail: string;
  }>;
  envFilePath: string | null;
  executionMode: string;
  bankrollUsd: number;
  maxTradePct: number;
  maxEventExposurePct: number;
  remotePositionCount: number;
  localOpenPositionCount: number;
  usdcBalance: number;
}

export function buildLiveTestDirectoryName(timestamp: string, runId: string | null): string {
  return `${timestamp}-${runId ?? "pending"}`;
}

export function evaluateLiveTestPreflight(input: LiveTestPreflightInput): LiveTestPreflightReport {
  const checks = [
    {
      key: "execution-mode",
      ok: input.executionMode === "live",
      detail: input.executionMode === "live"
        ? "AUTOPOLY_EXECUTION_MODE is live."
        : `AUTOPOLY_EXECUTION_MODE must be live. Received ${input.executionMode}.`
    },
    {
      key: "env-file",
      ok: Boolean(input.envFilePath),
      detail: input.envFilePath
        ? `Dedicated env file loaded from ${input.envFilePath}.`
        : "ENV_FILE must point to a dedicated live-test env file."
    },
    {
      key: "credentials",
      ok: input.hasPrivateKey && input.hasFunderAddress,
      detail: input.hasPrivateKey && input.hasFunderAddress
        ? "PRIVATE_KEY and FUNDER_ADDRESS are present."
        : "PRIVATE_KEY and FUNDER_ADDRESS are required."
    },
    {
      key: "database",
      ok: input.dbOk,
      detail: input.dbOk ? "Database connection is healthy." : "Database connection failed."
    },
    {
      key: "redis",
      ok: input.redisOk,
      detail: input.redisOk ? "Redis connection is healthy." : "Redis connection failed."
    },
    {
      key: "clob-client",
      ok: input.clobOk,
      detail: input.clobOk ? "Polymarket client initialized." : "Polymarket client initialization failed."
    },
    {
      key: "remote-positions",
      ok: input.remotePositionCount === 0,
      detail: input.remotePositionCount === 0
        ? "Remote address has no open positions."
        : `Remote address already has ${input.remotePositionCount} open position(s).`
    },
    {
      key: "local-state",
      ok: input.localOpenPositionCount === 0,
      detail: input.localOpenPositionCount === 0
        ? "Database state has no open positions."
        : `Database already has ${input.localOpenPositionCount} open position(s).`
    },
    {
      key: "bankroll-cap",
      ok: input.initialBankrollUsd === LIVE_TEST_BANKROLL_USD,
      detail: input.initialBankrollUsd === LIVE_TEST_BANKROLL_USD
        ? `INITIAL_BANKROLL_USD is pinned to ${LIVE_TEST_BANKROLL_USD}.`
        : `INITIAL_BANKROLL_USD must be ${LIVE_TEST_BANKROLL_USD}. Received ${input.initialBankrollUsd}.`
    },
    {
      key: "trade-cap",
      ok: input.maxTradePct <= LIVE_TEST_MAX_TRADE_PCT,
      detail: input.maxTradePct <= LIVE_TEST_MAX_TRADE_PCT
        ? `MAX_TRADE_PCT is capped at ${LIVE_TEST_MAX_TRADE_PCT}.`
        : `MAX_TRADE_PCT must be <= ${LIVE_TEST_MAX_TRADE_PCT}. Received ${input.maxTradePct}.`
    },
    {
      key: "event-cap",
      ok: input.maxEventExposurePct <= LIVE_TEST_MAX_EVENT_EXPOSURE_PCT,
      detail: input.maxEventExposurePct <= LIVE_TEST_MAX_EVENT_EXPOSURE_PCT
        ? `MAX_EVENT_EXPOSURE_PCT is capped at ${LIVE_TEST_MAX_EVENT_EXPOSURE_PCT}.`
        : `MAX_EVENT_EXPOSURE_PCT must be <= ${LIVE_TEST_MAX_EVENT_EXPOSURE_PCT}. Received ${input.maxEventExposurePct}.`
    },
    {
      key: "balance",
      ok: input.usdcBalance > 0,
      detail: input.usdcBalance > 0
        ? `Wallet reports ${input.usdcBalance.toFixed(2)} USDC allowance.`
        : "Wallet has no available USDC allowance."
    }
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks,
    envFilePath: input.envFilePath,
    executionMode: input.executionMode,
    bankrollUsd: input.initialBankrollUsd,
    maxTradePct: input.maxTradePct,
    maxEventExposurePct: input.maxEventExposurePct,
    remotePositionCount: input.remotePositionCount,
    localOpenPositionCount: input.localOpenPositionCount,
    usdcBalance: input.usdcBalance
  };
}
