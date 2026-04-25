# Balancer-inspired preview visual evaluation

Date: 2026-03-24

## Goal

- Use the `balancer.fi` homepage as the visual baseline.
- Iterate on the local preview until it passes this gate:
  - no oversized runaway display text
  - no obvious overflow
  - mostly unified surface language
  - acceptable information hierarchy

## Workflow

1. Build the local preview.
2. Save screenshots for both the local preview and the Balancer baseline with Playwright.
3. Let a `visual-eval-agent` score the result.
4. Only change the highest-impact visual problems.
5. Repeat screenshots and scoring until the gate passes.

## Screenshot archive

- Initial local preview:
  `/Users/Aincrad/dev-proj/autonomous-poly-trading/output/playwright/visual-eval/.playwright-cli/page-2026-03-24T07-14-15-006Z.png`
- Balancer baseline:
  `/Users/Aincrad/dev-proj/autonomous-poly-trading/output/playwright/visual-eval/.playwright-cli/page-2026-03-24T07-14-41-573Z.png`
- Second pass:
  `/Users/Aincrad/dev-proj/autonomous-poly-trading/output/playwright/visual-eval/.playwright-cli/page-2026-03-24T07-18-39-413Z.png`
- Third-pass accepted version:
  `/Users/Aincrad/dev-proj/autonomous-poly-trading/output/playwright/visual-eval/.playwright-cli/page-2026-03-24T07-22-32-412Z.png`

## Score history

### Pass 1

- Typography restraint: 4/10
- Information hierarchy: 5/10
- No overflow: 3/10
- Card alignment / rhythm: 4/10
- Overall premium feel: 4/10

Main issues:

- The main headline was too large and crushed the layout.
- The right-side cards looked faded and unfinished.
- The page rhythm felt like several systems stitched together.

### Pass 2

- Typography restraint: 6/10
- Information hierarchy: 6/10
- No overflow: 5/10
- Card alignment / rhythm: 6/10
- Overall premium feel: 6/10

Main issues:

- The right-side cards still felt weak.
- The main block stabilized, but the story was not yet singular enough.
- Shadows and lighter cards still felt slightly mixed.

### Pass 3

- Typography restraint: 7/10
- Information hierarchy: 7/10
- No overflow: 8/10
- Card alignment / rhythm: 7/10
- Overall premium feel: 7/10

Conclusion:

- The preview passed the baseline gate.
- The accepted version no longer has runaway display text or obvious overflow.
- Surface language and card rhythm are now coherent enough to continue from.

## What changed in this round

- Reduced display sizes across the three Balancer-inspired previews, shortened hero copy, and capped line width.
- Fixed the “latest time” card so it no longer rendered like an oversized metric.
- Used `:has(.preview-layout)` to hide the outer spectator shell on preview routes, so screenshots reflect the candidate UI instead of the main site chrome.
- Unified the right-side info cards with the main dark material language and fixed the CSS override bug that washed them out.
- Added a grid background and flat-line placeholder to the NAV chart so low-activity states do not look broken.

## Current accepted preview

- Preview URL:
  `http://127.0.0.1:3102/previews/balancer-flow`
- Main files:
  - `apps/web/components/preview-balancer-variants.tsx`
  - `apps/web/app/globals.css`

