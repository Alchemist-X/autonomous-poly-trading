import { createHash, randomUUID } from "node:crypto";
import { appUsers, getDb, hasDatabaseUrl, inviteCodes, predictionUsageEvents } from "@autopoly/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { auth, isOidcConfigured } from "../auth";
import {
  emailDomain,
  isAdminEmail,
  normalizeEmail,
  readBooleanEnv,
  shouldAutoActivate
} from "./prediction-access-rules";

export type PredictionAccessMode =
  | "disabled"
  | "setup_missing"
  | "unauthenticated"
  | "pending_invite"
  | "suspended"
  | "ready";

export interface PredictionAccessUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  status: string;
}

export interface PredictionQuotaSummary {
  dailyLimit: number | null;
  dailyUsed: number;
  monthlyLimit: number | null;
  monthlyUsed: number;
  concurrentLimit: number | null;
  running: number;
  bypassed: boolean;
}

export interface PredictionAccessState {
  mode: PredictionAccessMode;
  user?: PredictionAccessUser;
  quota?: PredictionQuotaSummary;
  missing?: string[];
  signInUrl?: string;
  inviteUrl?: string;
  message?: string;
}

interface ConsumeQuotaResult {
  allowed: boolean;
  status: number;
  usageEventId?: string;
  access: PredictionAccessState;
  error?: string;
}

function readLimitEnv(name: string, fallback: number): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed <= 0 ? null : Math.floor(parsed);
}

function getMissingAccessConfig(): string[] {
  const missing: string[] = [];
  if (!process.env.AUTH_SECRET?.trim()) {
    missing.push("AUTH_SECRET");
  }
  if (!process.env.OIDC_ISSUER?.trim()) {
    missing.push("OIDC_ISSUER");
  }
  if (!process.env.OIDC_CLIENT_ID?.trim()) {
    missing.push("OIDC_CLIENT_ID");
  }
  if (!process.env.OIDC_CLIENT_SECRET?.trim()) {
    missing.push("OIDC_CLIENT_SECRET");
  }
  if (!hasDatabaseUrl()) {
    missing.push("DATABASE_URL");
  }
  return missing;
}

export function isPredictionAccessConfigured(): boolean {
  return getMissingAccessConfig().length === 0 && isOidcConfigured();
}

export function isPredictionAuthRequired(): boolean {
  return readBooleanEnv("PREDICTION_AUTH_REQUIRED", false);
}

function hashInviteCode(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex");
}

function dayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

async function countUsageSince(userId: string, since: Date): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(predictionUsageEvents)
    .where(and(
      eq(predictionUsageEvents.userId, userId),
      eq(predictionUsageEvents.action, "prediction_run"),
      gte(predictionUsageEvents.startedAt, since)
    ));
  return Number(rows[0]?.count ?? 0);
}

async function countRunningUsage(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(predictionUsageEvents)
    .where(and(
      eq(predictionUsageEvents.userId, userId),
      eq(predictionUsageEvents.action, "prediction_run"),
      eq(predictionUsageEvents.status, "running")
    ));
  return Number(rows[0]?.count ?? 0);
}

async function quotaForUser(user: PredictionAccessUser): Promise<PredictionQuotaSummary> {
  const bypassed = user.role === "admin" && readBooleanEnv("PREDICTION_ADMIN_BYPASS_QUOTA", true);
  const dailyLimit = bypassed ? null : readLimitEnv("PREDICTION_DAILY_RUN_LIMIT", 5);
  const monthlyLimit = bypassed ? null : readLimitEnv("PREDICTION_MONTHLY_RUN_LIMIT", 50);
  const concurrentLimit = bypassed ? null : readLimitEnv("PREDICTION_CONCURRENT_RUN_LIMIT", 1);
  const now = new Date();
  const [dailyUsed, monthlyUsed, running] = await Promise.all([
    countUsageSince(user.id, dayStart(now)),
    countUsageSince(user.id, monthStart(now)),
    countRunningUsage(user.id)
  ]);
  return {
    dailyLimit,
    dailyUsed,
    monthlyLimit,
    monthlyUsed,
    concurrentLimit,
    running,
    bypassed
  };
}

async function upsertCurrentUser(): Promise<PredictionAccessUser | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  const issuer = session.user.oidcIssuer || process.env.OIDC_ISSUER || "oidc";
  const subject = session.user.id;
  const email = normalizeEmail(session.user.email);
  const role = isAdminEmail(email) ? "admin" : "user";
  const active = role === "admin" || shouldAutoActivate(email);
  const status = active ? "active" : "pending_invite";
  const db = getDb();
  const now = new Date();

  await db.insert(appUsers).values({
    id: randomUUID(),
    oidcIssuer: issuer,
    oidcSubject: subject,
    email,
    name: session.user.name ?? null,
    imageUrl: session.user.image ?? null,
    role,
    status,
    activatedAt: active ? now : null,
    lastLoginAt: now,
    updatedAt: now
  }).onConflictDoUpdate({
    target: [appUsers.oidcIssuer, appUsers.oidcSubject],
    set: {
      email,
      name: session.user.name ?? null,
      imageUrl: session.user.image ?? null,
      role: sql`case when ${appUsers.role} = 'admin' then ${appUsers.role} else ${role} end`,
      lastLoginAt: now,
      updatedAt: now
    }
  });

  const row = await db.query.appUsers.findFirst({
    where: and(eq(appUsers.oidcIssuer, issuer), eq(appUsers.oidcSubject, subject))
  });
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status
  };
}

export async function getPredictionAccessState(): Promise<PredictionAccessState> {
  const missing = getMissingAccessConfig();
  if (missing.length > 0) {
    if (isPredictionAuthRequired()) {
      return {
        mode: "setup_missing",
        missing,
        message: "Prediction auth is required, but configuration is incomplete."
      };
    }
    return {
      mode: "disabled",
      missing,
      message: "Prediction auth is not configured; demo access is currently open."
    };
  }

  const user = await upsertCurrentUser();
  if (!user) {
    return {
      mode: "unauthenticated",
      signInUrl: "/sign-in?next=/prediction-engine"
    };
  }
  if (user.status === "suspended") {
    return {
      mode: "suspended",
      user,
      message: "This account is suspended."
    };
  }
  if (user.status !== "active") {
    return {
      mode: "pending_invite",
      user,
      inviteUrl: "/invite",
      message: "Invite activation is required."
    };
  }

  return {
    mode: "ready",
    user,
    quota: await quotaForUser(user)
  };
}

export async function consumePredictionRunQuota(eventText: string): Promise<ConsumeQuotaResult> {
  const access = await getPredictionAccessState();
  if (access.mode === "disabled") {
    return { allowed: true, status: 200, access };
  }
  if (access.mode === "setup_missing") {
    return { allowed: false, status: 503, access, error: "Prediction auth is not configured." };
  }
  if (access.mode === "unauthenticated") {
    return { allowed: false, status: 401, access, error: "Sign in is required." };
  }
  if (access.mode === "pending_invite") {
    return { allowed: false, status: 403, access, error: "Invite activation is required." };
  }
  if (access.mode === "suspended") {
    return { allowed: false, status: 403, access, error: "Account is suspended." };
  }

  const quota = access.quota!;
  if (quota.dailyLimit != null && quota.dailyUsed >= quota.dailyLimit) {
    return { allowed: false, status: 429, access, error: "Daily prediction limit reached." };
  }
  if (quota.monthlyLimit != null && quota.monthlyUsed >= quota.monthlyLimit) {
    return { allowed: false, status: 429, access, error: "Monthly prediction limit reached." };
  }
  if (quota.concurrentLimit != null && quota.running >= quota.concurrentLimit) {
    return { allowed: false, status: 429, access, error: "Concurrent prediction limit reached." };
  }

  const usageEventId = randomUUID();
  await getDb().insert(predictionUsageEvents).values({
    id: usageEventId,
    userId: access.user!.id,
    status: "running",
    eventText: eventText.slice(0, 1000)
  });

  return { allowed: true, status: 200, usageEventId, access };
}

export async function completePredictionUsageEvent(input: {
  usageEventId?: string;
  status: "complete" | "failed";
  backendSource?: string | null;
  errorMessage?: string | null;
}) {
  if (!input.usageEventId) {
    return;
  }
  await getDb()
    .update(predictionUsageEvents)
    .set({
      status: input.status,
      backendSource: input.backendSource ?? null,
      errorMessage: input.errorMessage?.slice(0, 1000) ?? null,
      completedAt: new Date()
    })
    .where(eq(predictionUsageEvents.id, input.usageEventId));
}

export async function acceptInviteForCurrentUser(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getPredictionAccessState();
  if (access.mode === "unauthenticated") {
    return { ok: false, error: "Sign in is required before accepting an invite." };
  }
  if (!access.user) {
    return { ok: false, error: "User account is unavailable." };
  }
  if (access.user.status === "active") {
    return { ok: true };
  }
  const trimmed = code.trim();
  if (trimmed.length < 6) {
    return { ok: false, error: "Invite code is too short." };
  }

  const db = getDb();
  const invite = await db.query.inviteCodes.findFirst({
    where: eq(inviteCodes.codeHash, hashInviteCode(trimmed))
  });
  if (!invite || invite.status !== "active") {
    return { ok: false, error: "Invite code is invalid." };
  }
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Invite code has expired." };
  }
  if (invite.usedCount >= invite.maxUses) {
    return { ok: false, error: "Invite code has already been used." };
  }
  const allowedDomain = invite.allowedEmailDomain?.toLowerCase();
  if (allowedDomain && emailDomain(access.user.email) !== allowedDomain) {
    return { ok: false, error: "Invite code is not valid for this email domain." };
  }

  const now = new Date();
  await db.update(inviteCodes)
    .set({
      usedCount: sql`${inviteCodes.usedCount} + 1`,
      updatedAt: now
    })
    .where(eq(inviteCodes.id, invite.id));
  await db.update(appUsers)
    .set({
      status: "active",
      activatedAt: now,
      updatedAt: now
    })
    .where(eq(appUsers.id, access.user.id));
  return { ok: true };
}
