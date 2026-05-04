import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").primaryKey(),
  runtime: varchar("runtime", { length: 128 }).notNull(),
  mode: varchar("mode", { length: 16 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  bankrollUsd: numeric("bankroll_usd", { precision: 14, scale: 2 }).notNull(),
  promptSummary: text("prompt_summary").notNull().default(""),
  reasoningMd: text("reasoning_md").notNull().default(""),
  logsMd: text("logs_md").notNull().default(""),
  generatedAtUtc: timestamp("generated_at_utc", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const agentDecisions = pgTable("agent_decisions", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").notNull().references(() => agentRuns.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 16 }).notNull(),
  eventSlug: text("event_slug").notNull(),
  marketSlug: text("market_slug").notNull(),
  tokenId: text("token_id").notNull(),
  side: varchar("side", { length: 8 }).notNull(),
  notionalUsd: numeric("notional_usd", { precision: 14, scale: 2 }).notNull(),
  orderType: varchar("order_type", { length: 16 }).notNull(),
  aiProb: numeric("ai_prob", { precision: 8, scale: 6 }).notNull(),
  marketProb: numeric("market_prob", { precision: 8, scale: 6 }).notNull(),
  edge: numeric("edge", { precision: 8, scale: 6 }).notNull(),
  confidence: varchar("confidence", { length: 16 }).notNull(),
  thesisMd: text("thesis_md").notNull(),
  sources: jsonb("sources").notNull(),
  stopLossPct: numeric("stop_loss_pct", { precision: 8, scale: 6 }).notNull(),
  resolutionTrackRequired: boolean("resolution_track_required").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const executionEvents = pgTable("execution_events", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").references(() => agentRuns.id, { onDelete: "set null" }),
  decisionId: uuid("decision_id").references(() => agentDecisions.id, { onDelete: "set null" }),
  marketSlug: text("market_slug").notNull(),
  tokenId: text("token_id").notNull(),
  side: varchar("side", { length: 8 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  requestedNotionalUsd: numeric("requested_notional_usd", { precision: 14, scale: 2 }).notNull(),
  filledNotionalUsd: numeric("filled_notional_usd", { precision: 14, scale: 2 }).notNull().default("0"),
  avgPrice: numeric("avg_price", { precision: 8, scale: 6 }),
  orderId: text("order_id"),
  rawResponse: jsonb("raw_response"),
  timestampUtc: timestamp("timestamp_utc", { withTimezone: true }).notNull().defaultNow()
});

export const positions = pgTable("positions", {
  id: uuid("id").primaryKey(),
  eventSlug: text("event_slug").notNull(),
  marketSlug: text("market_slug").notNull(),
  tokenId: text("token_id").notNull(),
  side: varchar("side", { length: 8 }).notNull(),
  outcomeLabel: text("outcome_label").notNull(),
  size: numeric("size", { precision: 18, scale: 6 }).notNull(),
  avgCost: numeric("avg_cost", { precision: 8, scale: 6 }).notNull(),
  currentPrice: numeric("current_price", { precision: 8, scale: 6 }).notNull(),
  currentValueUsd: numeric("current_value_usd", { precision: 14, scale: 2 }).notNull(),
  unrealizedPnlPct: numeric("unrealized_pnl_pct", { precision: 8, scale: 6 }).notNull(),
  stopLossPct: numeric("stop_loss_pct", { precision: 8, scale: 6 }).notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true })
});

export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: uuid("id").primaryKey(),
  cashBalanceUsd: numeric("cash_balance_usd", { precision: 14, scale: 2 }).notNull(),
  totalEquityUsd: numeric("total_equity_usd", { precision: 14, scale: 2 }).notNull(),
  highWaterMarkUsd: numeric("high_water_mark_usd", { precision: 14, scale: 2 }).notNull(),
  drawdownPct: numeric("drawdown_pct", { precision: 8, scale: 6 }).notNull(),
  openPositions: integer("open_positions").notNull(),
  halted: boolean("halted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const riskEvents = pgTable("risk_events", {
  id: uuid("id").primaryKey(),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  severity: varchar("severity", { length: 16 }).notNull(),
  message: text("message").notNull(),
  relatedTokenId: text("related_token_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const resolutionChecks = pgTable("resolution_checks", {
  id: uuid("id").primaryKey(),
  eventSlug: text("event_slug").notNull(),
  marketSlug: text("market_slug").notNull(),
  trackStatus: varchar("track_status", { length: 32 }).notNull(),
  intervalMinutes: integer("interval_minutes").notNull(),
  nextCheckAt: timestamp("next_check_at", { withTimezone: true }),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  summary: text("summary").notNull().default(""),
  metadata: jsonb("metadata")
});

export const trackedSources = pgTable("tracked_sources", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").references(() => agentRuns.id, { onDelete: "set null" }),
  decisionId: uuid("decision_id").references(() => agentDecisions.id, { onDelete: "set null" }),
  eventSlug: text("event_slug").notNull(),
  marketSlug: text("market_slug").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  sourceKind: varchar("source_kind", { length: 64 }).notNull(),
  role: varchar("role", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  retrievedAtUtc: timestamp("retrieved_at_utc", { withTimezone: true }).notNull(),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  note: text("note"),
  contentHash: varchar("content_hash", { length: 128 }),
  metadata: jsonb("metadata")
});

export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").references(() => agentRuns.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 64 }).notNull(),
  title: text("title").notNull(),
  path: text("path").notNull(),
  content: text("content"),
  publishedAtUtc: timestamp("published_at_utc", { withTimezone: true }).notNull()
});

export const systemState = pgTable("system_state", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const managedUsers = pgTable("managed_users", {
  id: uuid("id").primaryKey(),
  privyDid: varchar("privy_did", { length: 128 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  eoaAddress: varchar("eoa_address", { length: 42 }).notNull(),
  safeAddress: varchar("safe_address", { length: 42 }),
  status: varchar("status", { length: 32 }).notNull().default("pending_deploy"),
  aiAutoTradeEnabled: boolean("ai_auto_trade_enabled").notNull().default(false),
  sessionSignerAuthorizedAt: timestamp("session_signer_authorized_at", { withTimezone: true }),
  sessionSignerRevokedAt: timestamp("session_signer_revoked_at", { withTimezone: true }),
  riskTier: varchar("risk_tier", { length: 16 }).notNull().default("balanced"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const managedDeposits = pgTable("managed_deposits", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => managedUsers.id, { onDelete: "cascade" }),
  txHash: varchar("tx_hash", { length: 66 }).notNull().unique(),
  amountUsd: numeric("amount_usd", { precision: 14, scale: 2 }).notNull(),
  tokenAddress: varchar("token_address", { length: 42 }).notNull(),
  blockNumber: integer("block_number"),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow()
});

// Phase 2 paper-mode dispatcher run record. One row per user per daily-pulse
// fan-out invocation. Phase 3 will add `mode = 'live'` rows + link executions.
export const managedPaperRuns = pgTable("managed_paper_runs", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => managedUsers.id, { onDelete: "cascade" }),
  mode: varchar("mode", { length: 16 }).notNull().default("paper"),
  status: varchar("status", { length: 32 }).notNull(),
  bankrollUsd: numeric("bankroll_usd", { precision: 14, scale: 2 }),
  decisionCount: integer("decision_count").notNull().default(0),
  startedAtUtc: timestamp("started_at_utc", { withTimezone: true }).notNull(),
  completedAtUtc: timestamp("completed_at_utc", { withTimezone: true }),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

// Per-market decisions produced by the managed-trading dispatcher.
// `risk_tier_at_decision` captures the user's tier at the moment the decision
// was made — immutable record so audit/PnL replay does not depend on the
// current `managed_users.risk_tier` value.
export const managedDecisions = pgTable("managed_decisions", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").notNull().references(() => managedPaperRuns.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => managedUsers.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 16 }).notNull(),
  eventSlug: text("event_slug").notNull(),
  marketSlug: text("market_slug").notNull(),
  tokenId: text("token_id").notNull(),
  side: varchar("side", { length: 8 }),
  notionalUsd: numeric("notional_usd", { precision: 14, scale: 2 }).notNull(),
  bankrollRatio: numeric("bankroll_ratio", { precision: 8, scale: 6 }).notNull(),
  aiProb: numeric("ai_prob", { precision: 8, scale: 6 }).notNull(),
  marketProb: numeric("market_prob", { precision: 8, scale: 6 }).notNull(),
  edge: numeric("edge", { precision: 8, scale: 6 }).notNull(),
  confidence: varchar("confidence", { length: 16 }),
  thesisMd: text("thesis_md").notNull(),
  riskTierAtDecision: varchar("risk_tier_at_decision", { length: 16 }).notNull(),
  riskCapsApplied: jsonb("risk_caps_applied"),
  skippedReason: text("skipped_reason"),
  metadata: jsonb("metadata"),
  createdAtUtc: timestamp("created_at_utc", { withTimezone: true }).notNull().defaultNow()
});
