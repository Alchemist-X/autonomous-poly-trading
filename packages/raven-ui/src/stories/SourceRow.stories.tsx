import type { Meta, StoryObj } from "@storybook/react-vite";
import { SourceRow } from "../components/SourceRow";

const meta: Meta<typeof SourceRow> = {
  title: "SourceRow",
  component: SourceRow,
};
export default meta;

type Story = StoryObj<typeof SourceRow>;

export const Evidence: Story = {
  args: {
    title: "Apple's foldable iPhone launch may slip to early 2027 — DigiTimes",
    url: "https://www.digitimes.com/news/apple-foldable-iphone-launch-2027.html",
    deltaPp: -13.6,
    from: 0.6,
    to: 0.46,
    explanation:
      "Most recent supply-chain signal pointing to consumer availability in 2027, not 2026; directly targets the shipment bar in the resolution criteria. Moderate because it's a supply-chain rumor, not confirmed.",
    verified: true,
    defaultOpen: true,
  },
};

export const Reflection: Story = {
  args: {
    kind: "reflection",
    title: "↻ reflection on: iPhone Fold is 'on track' to launch this September, per Mark Gurman",
    url: "https://www.macobserver.com/news/iphone-fold-delay-gurman/",
    deltaPp: -3.4,
    from: 0.36,
    to: 0.32,
    explanation:
      "Newer Gurman reporting hardens his stance to 'no doubt' about a staggered delay — the Fold ships 'a bit later' than the iPhone 18 Pro. This walks back the September-shipping optimism the original +7.9pp entry implied.",
    verified: true,
    defaultOpen: true,
  },
};

export const Unverified: Story = {
  args: {
    title: "Anonymous leaker claims an October foldable reveal",
    url: "https://example.com/rumor",
    deltaPp: 3.8,
    from: 0.17,
    to: 0.21,
    explanation: "Thin, single-sourced, and not found in the agent's search trace — applied at a soft-clamped weight.",
    verified: false,
    defaultOpen: true,
  },
};
