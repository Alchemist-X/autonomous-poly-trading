// The archived GTA 6 demo dossier — content ported verbatim from the design
// handoff's raven-gta6-data.js (real content from a 3-round run; market/betting
// sources removed per compliance direction; probability chains rebalanced so
// every iteration still sums).

import type { DossierVM } from "../vm/types";

export const GTA6_DEMO_ID = "gta6-demo";

const META = {
  question: "Will the GTA 6 launch be postponed again past its November 19, 2026 date?",
  prob: "7%",
  verdict: "Very unlikely",
  quip: "A third delay would be a real plot twist at this point.",
  prior: "38%",
  duration: "33m 35s",
  sources: "13",
  nSupport: "9",
  nCounter: "3",
  nNeutral: "1",
  why: "Raven lands at 7% because Rockstar has publicly committed to November 19 — pre-orders are open and the CEO reaffirmed the date on the record — while the two strongest delay signals, the “not content complete” report and the crunch narrative, were both walked back by newer evidence.",
  // Design-handoff copy edited: interval reference removed (user decision
  // 2026-07-02 — no confidence-interval claims anywhere in the product).
  confWhy: "Dense, mutually corroborating signals; both delay pillars walked back by newer evidence.",
  openUnc:
    "The real unknown is the gap between “content-complete / on track” claims and actual ship-readiness. Watch for a fresh Schreier-tier report reversing the consensus, any Rockstar/Take-Two language that hedges the date, or a Trailer 3 / pre-order misfire. The likeliest path to YES now is a quiet de-facto slip — which this question counts even without the word “delay”.",
  resDate: "2026-11-19",
  normQ:
    "Will Grand Theft Auto VI’s primary PS5 / Xbox Series X|S console launch be postponed to a date later than 2026-11-19 (or made indefinite), as judged at end-of-day 2026-11-19?",
  criteria:
    "Resolves on the primary PS5 / Xbox Series X|S console launch status at end-of-day 2026-11-19. YES if Rockstar or Take-Two officially announce a date later than 2026-11-19 (or indefinite) beforehand, or if the console version simply isn’t commercially available by then (a de-facto slip counts). NO if it ships on or before 2026-11-19 — even buggy. PC-version timing and minor regional staggers don’t count.",
  priorWhy:
    "Reference class: big-budget games (often called AAA games) delayed at least once and then recommitted to a fresh date, including Cyberpunk 2077, Red Dead Redemption 2, Grand Theft Auto V, and Starfield. Multi-delay history predicts further slippage; offset by a roughly five-month window, a November 2025 recommitment, and pre-orders opening June 25.",
  assumptions:
    "Verified 2026-06-22: the official date is 2026-11-19; no third delay announced; pre-orders open 2026-06-25. “The GTA 6 launch” means the primary console release, not the later, separately-dated PC version.",
  settlement:
    "Rockstar Games official newswire plus Rockstar / Take-Two official social and investor channels, corroborated by major gaming press (IGN, GameSpot, Eurogamer, Polygon) on or around 2026-11-19.",
  confidence: "high" as const
};

// side: "support" (pushes NO), "counter" (pushes YES), "neutral" (no directional weight)
const ITERATIONS: DossierVM["iterations"] = [
  {
    n: "01",
    from: "38%",
    to: "30%",
    net: "8%",
    netDir: "down",
    note: "The decisive development is Rockstar’s official June-25 pre-order and cover-art reveal — a concrete commitment five months out — reinforced by Take-Two’s May earnings reaffirmation. The one offsetting signal, Schreier’s “not content complete” report, keeps a delay scenario alive but was partly walked back.",
    evidence: [
      {
        id: "e01",
        title: "Grand Theft Auto VI Pre-Orders Begin on June 25",
        dom: "rockstargames.com",
        url: null,
        srcType: "official",
        srcLabel: "Official newswire",
        side: "support",
        cred: "high",
        value: "high",
        from: "38%",
        to: "26%",
        d: -12,
        revises: false,
        verified: true,
        focusId: "resolution-state",
        crossCheck: "confirmed",
        qualityScore: 96,
        sourceCount: 2,
        takeaway: "A costly public commitment ~5 months out — publishers rarely make it before a slip.",
        analysis:
          "Opening retail/digital pre-orders and committing official cover art months ahead is a concrete, costly action, not cheap talk; the strong public response reinforces it as a genuine NO signal."
      },
      {
        id: "e02",
        title: "GTA 6 Release Date Gets Official Update In Take-Two Earnings",
        dom: "screenrant.com",
        url: null,
        srcType: "press",
        srcLabel: "Press (earnings call)",
        side: "support",
        cred: "high",
        value: "high",
        from: "26%",
        to: "20%",
        d: -6,
        revises: false,
        verified: true,
        takeaway: "CEO ties ~$8.2B of guidance to the date and rules out another delay.",
        analysis:
          "An on-the-record investor reaffirmation raises the cost of slipping; discounted a little because verbal commitment was partly reflected in the prior already — moderate, not strong."
      },
      {
        id: "e03",
        title: "GTA 6 delay still possible after ‘not content complete’ report",
        dom: "notebookcheck.net",
        url: null,
        srcType: "insider",
        srcLabel: "Insider report",
        side: "counter",
        cred: "high",
        value: "high",
        from: "20%",
        to: "27%",
        d: 7,
        revises: false,
        verified: true,
        focusId: "strongest-countercase",
        crossCheck: "single_source",
        qualityScore: 68,
        sourceCount: 1,
        takeaway: "The strongest live delay signal — a high-reliability insider flags incompleteness.",
        analysis:
          "Schreier is a high-reliability insider, so a content-incompleteness flag is real delay-risk evidence; tempered because “not content complete” months out doesn’t force a slip, and a buggy Nov-19 launch still resolves NO."
      },
      {
        id: "e04",
        title: "New GTA 6 Delay Rumor Shot Down By Reporter as Misconstrued",
        dom: "gamespot.com",
        url: null,
        srcType: "press",
        srcLabel: "Press",
        side: "support",
        cred: "med",
        value: "low",
        from: "27%",
        to: "26%",
        d: -1,
        revises: false,
        verified: true,
        takeaway: "Walks back the delay narrative — but it’s the same underlying story.",
        analysis:
          "Weakens the Schreier-driven delay narrative; same underlying story (shared cluster), so it partially offsets that entry rather than counting as independent new evidence."
      },
      {
        id: "e05",
        title: "GTA 6 Third Delay Still Feared As Gamers Call Date ‘Cope’",
        dom: "gamingbible.com",
        url: null,
        srcType: "press",
        srcLabel: "Press",
        side: "counter",
        cred: "med",
        value: "low",
        from: "26%",
        to: "30%",
        d: 4,
        revises: false,
        verified: true,
        takeaway: "Crunch + fan doubt — a weak YES signal.",
        analysis:
          "Heavy end-stage crunch is consistent with a tight schedule, but it’s also the normal path to hitting a date; fan sentiment is not a reliable predictor — hence weak."
      }
    ]
  },
  {
    n: "02",
    from: "30%",
    to: "12%",
    net: "18%",
    netDir: "down",
    note: "Every new signal points to an on-time launch: the January “incomplete” flag turns out to be stale, a reliable insider sees nothing catastrophic, fresh content-complete reports land, and rival publishers vacate the November window. The disconfirmation search surfaced only stale or debunked delay rumors.",
    evidence: [
      {
        id: "e06",
        title: "The ‘not content complete’ report is now stale",
        dom: "rockstarintel.com",
        url: null,
        srcType: "insider",
        srcLabel: "Insider / leak",
        side: "support",
        cred: "med",
        value: "high",
        from: "30%",
        to: "23%",
        d: -7,
        revises: true,
        verified: true,
        focusId: "strongest-countercase",
        crossCheck: "contested",
        qualityScore: 74,
        sourceCount: 2,
        takeaway: "The prior YES pillar traces to early-2026 and is superseded.",
        analysis:
          "The +7% “not content complete” concern traces to early/January-2026 reporting and is superseded by newer content-complete reports; its YES weight is walked back."
      },
      {
        id: "e07",
        title: "GTA 6 Won’t Miss November Date, Says Popular Leaker",
        dom: "vice.com",
        url: null,
        srcType: "insider",
        srcLabel: "Insider report",
        side: "support",
        cred: "med",
        value: "med",
        from: "23%",
        to: "18%",
        d: -5,
        revises: false,
        verified: true,
        takeaway: "Reliable insider (NateTheHate) sees no red flags.",
        analysis:
          "A track-record insider’s absence-of-negative-signal is a genuine update, though it partly overlaps with the same studio chatter the content-complete reports draw on — kept moderate."
      },
      {
        id: "e08",
        title: "GTA 6 Is Now ‘Content Complete’, Sources Reveal",
        dom: "rockstarintel.com",
        url: null,
        srcType: "insider",
        srcLabel: "Insider / leak",
        side: "support",
        cred: "low",
        value: "med",
        from: "18%",
        to: "15%",
        d: -3,
        revises: false,
        verified: false,
        takeaway: "Addresses the main delay risk — but couldn’t be fully verified.",
        analysis:
          "Directly counters the remaining delay risk, but reports conflict and the fan/leak aggregator was rate-limited and couldn’t be fully verified — weak weight."
      },
      {
        id: "e09",
        title: "Other Publishers Flee the November Window",
        dom: "ibtimes.co.uk",
        url: null,
        srcType: "press",
        srcLabel: "Press",
        side: "support",
        cred: "med",
        value: "low",
        from: "15%",
        to: "12%",
        d: -3,
        revises: false,
        verified: true,
        takeaway: "The industry is scheduling around Rockstar.",
        analysis:
          "Rivals vacating the November window is revealed preference — they wouldn’t concede the season to a game they expected to slip — but it’s indirect and circumstantial, so it earns only a modest move."
      }
    ]
  },
  {
    n: "03",
    from: "12%",
    to: "7%",
    net: "5%",
    netDir: "down",
    note: "No new delay signal emerged. Launch marketing is executing on schedule and the CEO directly rebutted the crunch-delay narrative. The estimate settles just above its floor, holding back only the irreducible tail risk of any major open-world launch.",
    evidence: [
      {
        id: "e10",
        title: "Take-Two CEO reframes the crunch as deliberate",
        dom: "notebookcheck.net",
        url: null,
        srcType: "press",
        srcLabel: "Press",
        side: "support",
        cred: "high",
        value: "med",
        from: "12%",
        to: "8%",
        d: -4,
        revises: true,
        verified: true,
        takeaway: "Crunch is a strategy to avoid crunch — not a behind-schedule tell.",
        analysis:
          "Zelnick frames the extended timeline as a deliberate anti-crunch strategy rather than a sign of being behind; the crunch reports are anecdotal employee accounts. Walks back the +4% crunch weight."
      },
      {
        id: "e11",
        title: "When Is GTA 6 Trailer 3 Releasing? (June 2026 Update)",
        dom: "insider-gaming.com",
        url: null,
        srcType: "insider",
        srcLabel: "Insider report",
        side: "support",
        cred: "low",
        value: "low",
        from: "8%",
        to: "7%",
        d: -1,
        revises: false,
        verified: true,
        takeaway: "A studio near a forced delay pulls marketing — it isn’t.",
        analysis:
          "Accelerating into gameplay reveals is the opposite of a studio near a forced delay — but this is a rumor tightly correlated with the already-counted pre-order news, so only a small nudge."
      },
      {
        id: "e12",
        title: "GTA 6 Shuts Down Company Operations, Chaos Feared",
        dom: "gamingbible.com",
        url: null,
        srcType: "press",
        srcLabel: "Press",
        side: "neutral",
        cred: "low",
        value: "low",
        from: "7%",
        to: "7%",
        d: 0,
        revises: false,
        verified: true,
        takeaway: "Fan-culture color, no development signal.",
        analysis:
          "A lighthearted fan-culture story with effectively no probative weight in either direction; included for transparency."
      },
      {
        id: "e13",
        title: "GTA 6 Final Crunch Hits Rockstar, QA Working Until 3 AM",
        dom: "wccftech.com",
        url: null,
        srcType: "press",
        srcLabel: "Press",
        side: "counter",
        cred: "med",
        value: "low",
        from: "7%",
        to: "7%",
        d: 0,
        revises: false,
        verified: true,
        takeaway: "Corroborates the June crunch story — not independent.",
        analysis:
          "Corroborates the already-counted June crunch story rather than adding an independent data point; heavy crunch is also consistent with hitting the date."
      }
    ]
  }
];

// The Report summary narrative, with [NN] global-book-index references the UI
// turns into colored anchor links (hs = supporting, hc = counter).
const SUMMARY_PARAGRAPHS = [
  'The forecast opened from a **38% prior** — Grand Theft Auto VI has slipped twice, and twice-delayed big-budget games slip again more often than not. Then the evidence stacked one way: [hs:01]official pre-orders with cover art (01)[/] and [hs:02]Take-Two\'s on-the-record reaffirmation (02)[/] committed Rockstar publicly to the date, while reliable insiders reported no red flags. The decisive shift was watching the **two strongest delay pillars fail on reflection**: the [hc:03]"not content complete" report (03)[/] traced to __stale early-2026 reporting__ and was [hs:06]superseded by newer content-complete accounts (06)[/], and the [hc:05]crunch narrative (05)[/] was __reframed by the chief executive officer as a deliberate anti-crunch schedule (10)__. With both pillars walked back and confirmations still stacking, the probability of YES settled at **7%**. The residual 7% is honesty: a third delay is no longer base-rate-likely, but it is not impossible this close to a hard date.'
];

export const GTA6_DEMO: DossierVM = {
  id: GTA6_DEMO_ID,
  status: "complete",
  meta: META,
  iterations: ITERATIONS,
  core: [
    { id: "e01", rank: "Biggest move" },
    { id: "e06", rank: "Key reversal" },
    { id: "e02", rank: "On the record" }
  ],
  topCounter: {
    id: "e03",
    resolution:
      "Walked back in iteration 2 — the flag traced to stale early-2026 reporting and was superseded by content-complete accounts (06)."
  },
  provider: null,
  isDemo: true,
  currentProb: 0.07,
  priorProb: 0.38,
  maxRounds: 3,
  startedAtUtc: null,
  summaryParagraphs: SUMMARY_PARAGRAPHS,
  researchPlan: {
    archetype: "product release",
    modelKind: "binary Bayesian update",
    modelRationale:
      "Maintain one probability for a further delay and update it only when an atomic factual claim adds information beyond the reference class.",
    searchStrategy:
      "Search broadly across official release records, investor statements, retailer commitments, high-quality original reporting, and the strongest evidence of schedule slippage; then retain only sources that add independent information.",
    minimumSearchQueries: 6,
    focusAreas: [
      {
        id: "resolution-state",
        question: "What directly establishes whether the 19 November 2026 console date still stands?",
        whyItMatters: "Official release and distribution records most directly answer the resolution rule.",
        priority: "high",
        preferredSources: ["Rockstar Games newswire", "Take-Two investor statements", "retailer availability records"],
        completionCriteria: "One direct official record plus an independent distribution or reporting cross-check."
      },
      {
        id: "outside-view",
        question: "How often do comparable big-budget games slip again after two delays and a public recommitment?",
        whyItMatters: "The outside view anchors the forecast before vivid current reporting is weighed.",
        priority: "high",
        preferredSources: [
          "publisher release histories",
          "archived official dates",
          "structured game release datasets"
        ],
        completionCriteria:
          "Comparable cases list exact recommitment dates, final ship dates, similarities, and differences."
      },
      {
        id: "strongest-countercase",
        question: "What is the strongest current evidence that development or distribution is still behind schedule?",
        whyItMatters: "The low delay estimate should survive a deliberate search for the best contrary evidence.",
        priority: "high",
        preferredSources: [
          "attributable original reporting",
          "direct employee or publisher statements",
          "retailer schedule changes"
        ],
        completionCriteria:
          "The strongest delay claim is independently checked or explicitly retained as a single-source risk."
      }
    ],
    sourcePriorities: [
      {
        rank: 1,
        sourceClass: "Official release, investor, and retailer records",
        useWhen: "The record directly dates launch, pre-orders, distribution, or a delay.",
        rejectWhen: "It repeats promotional language without a concrete date or commitment."
      },
      {
        rank: 2,
        sourceClass: "Independent original reporting",
        useWhen: "Named reporters provide attributable development or distribution information.",
        rejectWhen: "The item merely rewrites an unnamed rumor."
      },
      {
        rank: 3,
        sourceClass: "Secondary summaries and fan commentary",
        useWhen: "They identify a lead that can be verified elsewhere.",
        rejectWhen: "They are the sole basis for a material probability change."
      }
    ]
  },
  probabilityModelExplanation:
    "The model starts from the delay rate of comparable big-budget releases, then applies one update per independently checkable claim. Several articles repeating the same announcement only improve corroboration; they do not move the probability several times.",
  scenarios: [
    {
      name: "Date holds",
      description:
        "Marketing, retail preparation, and final production continue without a new high-quality delay report.",
      implication: "This is the path most consistent with the current low delay estimate."
    },
    {
      name: "Late operational slip",
      description:
        "A certification, production, or distribution problem appears after the public marketing commitment.",
      implication: "This is the main remaining path to a further postponement."
    }
  ],
  monitoringSignals: [
    {
      signal: "Rockstar or Take-Two begins hedging or removes the 19 November date from official materials.",
      direction: "raises",
      component: "Direct settlement evidence"
    },
    {
      signal: "Retailers publish confirmed inventory or delivery schedules tied to 19 November.",
      direction: "lowers",
      component: "Distribution readiness"
    }
  ],
  informationGaps: [
    {
      gap: "No public first-party production-readiness record is available.",
      importance: "Marketing can remain on schedule even when certification or manufacturing is late.",
      retrievalPath: "Monitor official filings, retailer delivery systems, and attributable original reporting."
    }
  ]
};
