import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildDeltaPmAudit } from "./delta-pm-audit";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "dpm-audit-"));
  mkdirSync(path.join(dir, "signals"), { recursive: true });
  mkdirSync(path.join(dir, "theses"), { recursive: true });
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

function ledger(event: Record<string, unknown>): void {
  appendFileSync(path.join(dir, "ledger.jsonl"), JSON.stringify(event) + "\n");
}

describe("buildDeltaPmAudit", () => {
  it("returns null when no ledger exists", () => {
    expect(buildDeltaPmAudit(path.join(dir, "missing"))).toBeNull();
  });

  it("joins news → signal → thesis → decision → execution → position", () => {
    ledger({ ts: "2026-08-22T10:00:00Z", type: "service_start" });
    ledger({ ts: "2026-08-22T10:01:00Z", type: "news_seen", newsId: "n1", title: "SNDK wins contract", publishedUtc: "2026-08-22T09:55:00Z", kind: "manual", prefix: "none" });
    writeFileSync(path.join(dir, "signals", "s1.json"), JSON.stringify({ id: "sig1", newsId: "n1", title: "SNDK wins contract", materiality: { tickers: ["SNDK"] }, pricedIn: { status: "none" } }));
    writeFileSync(path.join(dir, "theses", "t1.json"), JSON.stringify({ id: "th1", signalId: "sig1", ticker: "SNDK", direction: "long" }));
    ledger({ ts: "2026-08-22T10:05:00Z", type: "decision", decision: { id: "d1", thesisId: "th1", action: "open", audit: { vetoedBy: null } } });
    ledger({ ts: "2026-08-22T10:05:10Z", type: "paper_open", decisionId: "d1", ticker: "SNDK", fillPx: 1603.4 });
    ledger({ ts: "2026-08-23T09:00:00Z", type: "stop_loss", ticker: "SNDK", exitPx: 1580, pnlUsd: -44 });
    writeFileSync(path.join(dir, "portfolio.json"), JSON.stringify({ positions: [{ ticker: "SNDK", direction: "long" }] }));

    const audit = buildDeltaPmAudit(dir)!;
    expect(audit.cases).toHaveLength(1);
    const c = audit.cases[0] as Record<string, any>;
    expect(c.news.newsId).toBe("n1");
    expect(c.signal.id).toBe("sig1");
    expect(c.thesis.id).toBe("th1");
    expect(c.decision.id).toBe("d1");
    expect(c.decision.ts).toBe("2026-08-22T10:05:00Z");
    expect(c.execution.fillPx).toBe(1603.4);
    expect(c.positionNow.ticker).toBe("SNDK");
    expect(c.postEvents).toHaveLength(1);
    expect(audit.bookStartedUtc).toBe("2026-08-22T10:00:00Z");
  });

  it("keeps archived news as chain-less cases and dedupes restart re-logs, newest first", () => {
    ledger({ ts: "2026-08-22T10:00:00Z", type: "news_seen", newsId: "old", title: "Old" });
    ledger({ ts: "2026-08-22T11:00:00Z", type: "news_seen", newsId: "new", title: "New" });
    ledger({ ts: "2026-08-22T12:00:00Z", type: "news_seen", newsId: "old", title: "Old re-logged" });
    const audit = buildDeltaPmAudit(dir)!;
    expect(audit.cases.map((c: any) => c.news.newsId)).toEqual(["old", "new"]);
    expect(audit.cases[0]).toMatchObject({ signal: null, thesis: null, decision: null });
  });
});
