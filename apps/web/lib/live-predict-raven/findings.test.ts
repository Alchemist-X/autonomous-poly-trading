import { describe, expect, it } from "vitest";
import { deriveFindings } from "./findings";
import { PAPER_SNAPSHOT } from "./snapshot";
import type { DecisionEpisode, PaperSnapshot } from "./snapshot";

const episode = (over: Partial<DecisionEpisode> = {}): DecisionEpisode => ({
  positionId: "mkt:1",
  slug: "mkt",
  question: "某市场？",
  side: "NO",
  status: "closed",
  openedUtc: "2026-07-01T00:00:00.000Z",
  closedUtc: "2026-07-05T00:00:00.000Z",
  holdDays: 4,
  shares: 1000,
  entryPrice: 0.4,
  costUsd: 400,
  exitPrice: 0.3,
  benchmarkPrice: 0.9,
  benchmarkSource: "live",
  entryAlphaUsd: 500,
  exitAlphaUsd: -600,
  pnlUsd: -100,
  exitReason: "negative_edge",
  exitStyle: "market",
  entryEdgePp: 12,
  agentProbAtEntry: 0.8,
  marketProbAtEntry: 0.6,
  roundsAtEntry: 3,
  evidenceAtEntry: 11,
  reviewCount: 4,
  ...over
});

function snapshotWith(over: Partial<PaperSnapshot>): PaperSnapshot {
  return { ...PAPER_SNAPSHOT, ...over } as PaperSnapshot;
}

const idsOf = (s: PaperSnapshot): string[] => deriveFindings(s, "zh").map((f) => f.id);

describe("deriveFindings", () => {
  it("always leads with the pnl composition, using the live numbers", () => {
    const findings = deriveFindings(PAPER_SNAPSHOT, "zh");
    expect(findings[0]?.id).toBe("pnl-composition");
    expect(findings[0]?.title).toContain("$10,000");
  });

  it("degrades to a headline-only read when the decomposition is absent", () => {
    const ids = idsOf(snapshotWith({ decisionQuality: null }));
    expect(ids).not.toContain("entry-quality");
    expect(ids).not.toContain("exit-quality");
    expect(ids[0]).toBe("pnl-composition");
  });

  it("labels a positive entry contribution a strength and a negative exit a risk", () => {
    const findings = deriveFindings(
      snapshotWith({
        decisionQuality: {
          benchmarkAsOfUtc: null,
          entry: { totalUsd: 988, openUsd: 1625, closedUsd: -637, scored: 30, unscored: 0 },
          exit: { totalUsd: -455, scored: 18, unscored: 2 },
          reconciliation: { closedPnlUsd: -1091.66, realizedPnlUsd: -1091.67, deltaUsd: 0.01 },
          episodes: [episode()]
        }
      })
    );
    expect(findings.find((f) => f.id === "entry-quality")?.kind).toBe("strength");
    expect(findings.find((f) => f.id === "exit-quality")?.kind).toBe("risk");
  });

  it("raises a cooldown proposal only when re-entries actually lost money", () => {
    const losing = [
      episode({ exitReason: "stop_loss", pnlUsd: -200 }),
      episode({ openedUtc: "2026-07-06T00:00:00.000Z", pnlUsd: -150 })
    ];
    const winning = [
      episode({ exitReason: "stop_loss", pnlUsd: -200 }),
      episode({ openedUtc: "2026-07-06T00:00:00.000Z", pnlUsd: 400 })
    ];
    const withEpisodes = (episodes: DecisionEpisode[]): PaperSnapshot =>
      snapshotWith({
        decisionQuality: {
          benchmarkAsOfUtc: null,
          entry: { totalUsd: 0, openUsd: 0, closedUsd: 0, scored: 0, unscored: 0 },
          exit: { totalUsd: 0, scored: 0, unscored: 0 },
          reconciliation: { closedPnlUsd: 0, realizedPnlUsd: 0, deltaUsd: 0 },
          episodes
        }
      });
    expect(idsOf(withEpisodes(losing))).toContain("proposal-cooldown");
    const winIds = idsOf(withEpisodes(winning));
    expect(winIds).toContain("stop-loss-reentry");
    expect(winIds).not.toContain("proposal-cooldown");
  });

  it("flags a low-price stop only when the contract recovered above the exit", () => {
    const whipsaw = episode({ exitReason: "stop_loss", entryPrice: 0.22, exitPrice: 0.1, benchmarkPrice: 1 });
    const justWrong = episode({ exitReason: "stop_loss", entryPrice: 0.22, exitPrice: 0.1, benchmarkPrice: 0 });
    const withEpisodes = (e: DecisionEpisode): PaperSnapshot =>
      snapshotWith({
        decisionQuality: {
          benchmarkAsOfUtc: null,
          entry: { totalUsd: 0, openUsd: 0, closedUsd: 0, scored: 0, unscored: 0 },
          exit: { totalUsd: 0, scored: 0, unscored: 0 },
          reconciliation: { closedPnlUsd: 0, realizedPnlUsd: 0, deltaUsd: 0 },
          episodes: [e]
        }
      });
    expect(idsOf(withEpisodes(whipsaw))).toContain("stop-loss-lowprice");
    expect(idsOf(withEpisodes(justWrong))).not.toContain("stop-loss-lowprice");
  });

  it("names the dominant theme when open positions cluster on one story", () => {
    const finding = deriveFindings(PAPER_SNAPSHOT, "zh").find((f) => f.id === "theme-concentration");
    // The baked snapshot is an all-Iran geopolitics book.
    expect(finding?.title).toContain("伊朗");
    expect(finding?.kind).toBe("risk");
  });

  it("keeps every risk-parameter change as a proposal, never an applied change", () => {
    for (const f of deriveFindings(PAPER_SNAPSHOT, "zh")) {
      if (f.id.startsWith("proposal-")) {
        expect(f.kind).toBe("proposal");
        expect(f.body).toMatch(/确认/);
      }
    }
  });

  it("defaults to Chinese when lang is omitted", () => {
    expect(deriveFindings(PAPER_SNAPSHOT)[0]?.title).toBe(deriveFindings(PAPER_SNAPSHOT, "zh")[0]?.title);
  });

  describe("en mode", () => {
    it("emits the same finding ids and kinds in both languages", () => {
      const zhFindings = deriveFindings(PAPER_SNAPSHOT, "zh");
      const enFindings = deriveFindings(PAPER_SNAPSHOT, "en");
      expect(enFindings.map((f) => f.id)).toEqual(zhFindings.map((f) => f.id));
      expect(enFindings.map((f) => f.kind)).toEqual(zhFindings.map((f) => f.kind));
    });

    it("translates the headline and theme label, keeping the numbers", () => {
      const findings = deriveFindings(PAPER_SNAPSHOT, "en");
      expect(findings[0]?.title).toContain("Bankroll $10,000");
      expect(findings[0]?.title).toContain("equity $7,974");
      const theme = findings.find((f) => f.id === "theme-concentration");
      expect(theme?.title).toContain("Iran / Mideast standoff");
      expect(theme?.title).not.toMatch(/[一-鿿]/);
      expect(findings[0]?.metrics.map((m) => m.label)).toContain("Max drawdown");
    });

    it("keeps proposals gated on the owner's confirmation in English too", () => {
      for (const f of deriveFindings(PAPER_SNAPSHOT, "en")) {
        if (f.id.startsWith("proposal-")) {
          expect(f.kind).toBe("proposal");
          expect(f.body).toMatch(/confirm/);
        }
      }
    });
  });
});
