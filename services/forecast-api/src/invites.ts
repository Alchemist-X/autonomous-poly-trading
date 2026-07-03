// Invite-code store shared by the API and the raven web app through the
// artifacts volume. Event-sourced: an append-only JSONL of create/revoke/use
// events. Small O_APPEND writes are atomic, so two containers never lose each
// other's updates, and the current table is a cheap fold over a few KB.
// Trade-off (documented): a simultaneous last-slot use from both processes can
// overshoot maxUses by one — acceptable for run metering, and the price of
// having no database process at all.

import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { forecastsRoot } from "./repo";

export interface InviteRecord {
  code: string;
  label: string;
  maxUses: number | null;
  expiresAt: string | null;
  createdAtUtc: string;
  revoked: boolean;
  uses: number;
  lastUsedAtUtc: string | null;
}

interface InviteEvent {
  t: "create" | "revoke" | "use";
  code: string;
  ts: string;
  label?: string;
  maxUses?: number | null;
  expiresAt?: string | null;
  surface?: string;
  eventId?: string;
}

export function invitesFile(): string {
  return path.join(path.dirname(forecastsRoot()), "invites", "events.jsonl");
}

function appendEvent(event: InviteEvent): void {
  const file = invitesFile();
  mkdirSync(path.dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(event) + "\n", "utf8");
}

function readEvents(): InviteEvent[] {
  const file = invitesFile();
  if (!existsSync(file)) return [];
  const out: InviteEvent[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as InviteEvent;
      if (parsed && typeof parsed.code === "string" && typeof parsed.t === "string") out.push(parsed);
    } catch {
      // tolerate a torn write at the tail — later events still count
    }
  }
  return out;
}

export function inviteTable(): Map<string, InviteRecord> {
  const table = new Map<string, InviteRecord>();
  for (const e of readEvents()) {
    const existing = table.get(e.code);
    if (e.t === "create") {
      // First create wins (both containers may race to seed the same code).
      if (!existing) {
        table.set(e.code, {
          code: e.code,
          label: e.label ?? "",
          maxUses: typeof e.maxUses === "number" ? e.maxUses : null,
          expiresAt: e.expiresAt ?? null,
          createdAtUtc: e.ts,
          revoked: false,
          uses: 0,
          lastUsedAtUtc: null
        });
      }
    } else if (e.t === "revoke" && existing) {
      table.set(e.code, { ...existing, revoked: true });
    } else if (e.t === "use" && existing) {
      table.set(e.code, { ...existing, uses: existing.uses + 1, lastUsedAtUtc: e.ts });
    }
  }
  return table;
}

export type InviteState = "ok" | "unknown" | "revoked" | "expired" | "exhausted";

function expiryMs(expiresAt: string): number {
  // A date-only value means "valid through that whole UTC day".
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(expiresAt) ? `${expiresAt}T23:59:59Z` : expiresAt);
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

export function inviteState(code: string, now: number = Date.now()): InviteState {
  const rec = inviteTable().get(code.trim());
  if (!rec) return "unknown";
  if (rec.revoked) return "revoked";
  if (rec.expiresAt && now > expiryMs(rec.expiresAt)) return "expired";
  if (rec.maxUses !== null && rec.uses >= rec.maxUses) return "exhausted";
  return "ok";
}

export function describeInviteState(state: InviteState): string {
  switch (state) {
    case "unknown":
      return "invite code not recognized — check it and try again";
    case "revoked":
      return "this invite code has been revoked";
    case "expired":
      return "this invite code has expired";
    case "exhausted":
      return "this invite code has used up its run allowance";
    case "ok":
      return "invite code accepted";
  }
}

// Validate + meter in one step. Call ONLY when the code actually unlocks a
// gated spawn (under free quota the code is never charged).
export function authorizeInviteUse(code: string, surface: string, eventId?: string): boolean {
  const c = code.trim();
  if (!c || inviteState(c) !== "ok") return false;
  appendEvent({ t: "use", code: c, surface, eventId, ts: new Date().toISOString() });
  return true;
}

export interface CreateInviteOptions {
  code?: string;
  label?: string;
  maxUses?: number | null;
  expiresAt?: string | null;
}

export function createInvite(opts: CreateInviteOptions = {}): InviteRecord {
  const code = opts.code?.trim() || `raven-${randomBytes(3).toString("hex")}`;
  if (inviteTable().has(code)) throw new Error(`invite code "${code}" already exists`);
  appendEvent({
    t: "create",
    code,
    label: opts.label ?? "",
    maxUses: opts.maxUses ?? null,
    expiresAt: opts.expiresAt ?? null,
    ts: new Date().toISOString()
  });
  const rec = inviteTable().get(code);
  if (!rec) throw new Error("invite creation failed to persist");
  return rec;
}

export function revokeInvite(code: string): boolean {
  if (!inviteTable().has(code.trim())) return false;
  appendEvent({ t: "revoke", code: code.trim(), ts: new Date().toISOString() });
  return true;
}

// Keep the historical env-configured code working: seed it as a real record on
// first boot (idempotent; both containers may call this).
export function ensureSeeded(envCode: string | undefined | null): void {
  const code = envCode?.trim();
  if (!code) return;
  if (inviteTable().has(code)) return;
  appendEvent({ t: "create", code, label: "seeded-from-env", maxUses: null, expiresAt: null, ts: new Date().toISOString() });
}
