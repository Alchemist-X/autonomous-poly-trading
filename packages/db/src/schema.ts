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
