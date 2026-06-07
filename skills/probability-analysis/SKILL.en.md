---
name: probability-analysis
description: "Use for objective probability forecasts on political, diplomatic, military, regulatory, technology, company, or other future events. Trigger when the user asks for probability, fair probability, win rate, edge, whether something will happen, or a structured evidence-based re-analysis."
---

# Probability Analysis

Use this skill for auditable event forecasts. The goal is to provide a concrete probability and show how it follows from definitions, evidence, and a structured model.

## When to use

- Future political, diplomatic, military, regulatory, legal, election, company, or technology events.
- User asks for “probability,” “win rate,” “fair probability,” “edge,” or whether something will happen.
- If the user asks to ignore prediction-market pricing, record that exclusion and do not use market prices for probability updates.

## Workflow

1. **Clarify resolution**
   - State the Yes/No trigger, deadline, timezone, parties, and official recognition standard.
   - Identify boundary traps: whether an MOU counts, whether unilateral claims count, whether press reporting counts, and who can represent each party.

2. **Base reasoning and search design**
   - Decompose the event into 2-5 necessary conditions or key nodes.
   - Build search queries for each node across official statements, mainstream media, local/party media, third-party analysis, political dynamics, and military/economic dynamics.
   - For time-sensitive events, web-search is mandatory. Prefer official and primary sources first, then mainstream reporting for factual gaps.

3. **Collect and list evidence**
   - Group evidence by source type: official statements, mainstream media, party/local media, third-party analysis, political dynamics, military/security dynamics.
   - Preserve date, source, original URL, short excerpt, which node it supports/opposes, and reliability.
   - For copyrighted or paywalled reporting, archive URL/title/date and short excerpts only; do not reproduce full articles in the response.

4. **Evidence-weight update**
   - Score each item as strong support / medium support / weak support / neutral / weak opposition / medium opposition / strong opposition.
   - Weight by primary-source status, recency, verifiability, cross-source corroboration, and risk of strategic leaking.
   - Distinguish “talks are ongoing” from “a resolution-qualified agreement has been reached.”

5. **Build the structured model**
   - Use conditional decomposition:
     - `P(Yes) = P(A) × P(B|A) × P(C|A∩B) ...`
   - A/B/C should come from resolution-required conditions, not arbitrary labels.
   - Provide each node’s probability, rationale, main evidence, and residual uncertainty.

6. **Bayesian-style update and final judgment**
   - Start from a baseline and explain how important evidence moves it up or down.
   - Output one main probability and an 80% subjective credible interval.
   - If a data class such as prediction-market pricing is excluded, explicitly say it was not used.

7. **Output format**
   - Give the conclusion probability first.
   - Then provide the model table, key evidence table, upward/downward factors, and observation points most likely to trigger Yes/No.
   - Include archive or source-manifest paths for review.

## Do not

- Do not infer probabilities from prediction-market prices unless the user explicitly asks to include market signals.
- Do not treat unilateral optimism as a mutual official agreement.
- Do not invent official statements or nonexistent citations when evidence is thin.
- Do not give only vague labels such as “likely/unlikely”; provide a concrete probability.
