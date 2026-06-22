import type { Meta, StoryObj } from "@storybook/react-vite";
import { IterationRow } from "../components/IterationRow";

const meta: Meta<typeof IterationRow> = {
  title: "IterationRow",
  component: IterationRow,
};
export default meta;

type Story = StoryObj<typeof IterationRow>;

const sources = [
  {
    title: "Apple's foldable iPhone launch may slip to early 2027 — DigiTimes",
    url: "https://www.digitimes.com/news/apple-foldable-iphone-launch-2027.html",
    deltaPp: -13.6,
    from: 0.6,
    to: 0.46,
    explanation: "Most recent supply-chain signal pointing to consumer availability in 2027, not 2026.",
    verified: true,
  },
  {
    title: "Kuo: foldable iPhone on Apple's 2026 product roadmap — MacRumors",
    url: "https://www.macrumors.com/2026/05/kuo-foldable-iphone-2026-roadmap/",
    deltaPp: 11.4,
    from: 0.46,
    to: 0.30,
    explanation: "A credible analyst placing it on the 2026 roadmap raises the probability, though roadmaps slip.",
    verified: true,
  },
];

export const Open: Story = {
  args: {
    round: 1,
    priorProb: 0.6,
    postProb: 0.31,
    reasoning:
      "Starting from a 60% prior. Fresh supply-chain reporting is more bearish than the prior: multiple signals point at a 2027 slip, partially offset by a roadmap note. Net: down sharply.",
    whyChanged: { netPp: -28.9, upPp: 7.9, downPp: -36.8, dominantTitle: "Apple's foldable iPhone launch may slip to early 2027 — DigiTimes" },
    sources,
    defaultOpen: true,
  },
};

export const Closed: Story = {
  args: {
    round: 2,
    priorProb: 0.31,
    postProb: 0.36,
    reasoning: "A weaker supplier hint about trial production nudges the estimate back up slightly.",
    whyChanged: { netPp: 4.9, upPp: 6.2, downPp: -1.3, dominantTitle: "Supplier hints trial production has begun" },
    sources,
    defaultOpen: false,
  },
};
