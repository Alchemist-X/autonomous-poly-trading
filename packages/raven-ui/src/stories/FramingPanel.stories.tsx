import type { Meta, StoryObj } from "@storybook/react-vite";
import { FramingPanel } from "../components/FramingPanel";

const meta: Meta<typeof FramingPanel> = {
  title: "FramingPanel",
  component: FramingPanel,
};
export default meta;

type Story = StoryObj<typeof FramingPanel>;

const foldableRows = [
  {
    label: "NORMALIZED QUESTION",
    value:
      "Will Apple announce a foldable iPhone at an official event on or before December 31, 2026?",
  },
  {
    label: "RESOLUTION CRITERIA",
    value:
      "Resolves YES if Apple publicly unveils a foldable iPhone (a folding-display device marketed under the iPhone brand) at a keynote, press release, or filing before the deadline. Prototypes, leaks, and supply-chain reports do not count.",
  },
  {
    label: "RESOLUTION DATE",
    value: "December 31, 2026 — 23:59 ET",
  },
  {
    label: "SETTLEMENT SOURCE",
    value: "Apple Newsroom and the official Apple keynote stream, corroborated by two major outlets.",
  },
  {
    label: "PRIOR · 15%",
    value:
      "Base rate for a new flagship Apple form factor shipping within a named calendar year is low; foldable trial production is early and Apple has never pre-committed to the category.",
  },
  {
    label: "ASSUMPTIONS",
    value:
      "An 'announcement' includes a dated reveal even if shipping slips into 2027. A developer-only or enterprise-only unveil still counts as an announcement.",
  },
];

export const Closed: Story = {
  args: {
    rows: foldableRows,
    defaultOpen: false,
  },
};

export const Open: Story = {
  args: {
    rows: foldableRows,
    defaultOpen: true,
  },
};

export const Bitcoin: Story = {
  args: {
    defaultOpen: true,
    rows: [
      {
        label: "NORMALIZED QUESTION",
        value: "Will Bitcoin close above $150,000 on any UTC day before October 1, 2026?",
      },
      {
        label: "RESOLUTION CRITERIA",
        value:
          "Resolves YES if the BTC/USD daily close (00:00 UTC) on Coinbase exceeds $150,000 at least once in the window. Intraday wicks that do not hold to the close do not count.",
      },
      { label: "RESOLUTION DATE", value: "October 1, 2026 — 00:00 UTC" },
      {
        label: "SETTLEMENT SOURCE",
        value: "Coinbase BTC-USD daily close, cross-checked against the CoinGecko reference rate.",
      },
      {
        label: "PRIOR · 31%",
        value:
          "Spot is ~$108k with three months of runway; a 39% move is large but within one-quarter historical volatility for BTC during an ETF-inflow regime.",
      },
      {
        label: "ASSUMPTIONS",
        value: "A single qualifying daily close resolves YES; no requirement to sustain the level.",
      },
    ],
  },
};

export const FedRate: Story = {
  args: {
    defaultOpen: true,
    rows: [
      {
        label: "NORMALIZED QUESTION",
        value: "Will the FOMC cut the federal funds target range at its September 2026 meeting?",
      },
      {
        label: "RESOLUTION CRITERIA",
        value:
          "Resolves YES if the upper bound of the federal funds target range announced on Sept 16, 2026 is below the prior level by any amount. A hold or a hike resolves NO.",
      },
      { label: "RESOLUTION DATE", value: "September 16, 2026 — 14:00 ET (statement release)" },
      {
        label: "SETTLEMENT SOURCE",
        value: "The official FOMC statement published on federalreserve.gov.",
      },
      {
        label: "PRIOR · 58%",
        value:
          "Disinflation has stalled near 2.6% but the labor market is softening; the Committee's June dot plot penciled in one more cut, leaning the base rate above 50%.",
      },
      {
        label: "ASSUMPTIONS",
        value:
          "An inter-meeting emergency cut before Sept 16 also resolves YES. A 25bp or 50bp cut both qualify equally.",
      },
    ],
  },
};
