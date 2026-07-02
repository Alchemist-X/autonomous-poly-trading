import type { Meta, StoryObj } from "@storybook/react-vite";
import { EvidenceCard } from "../components/EvidenceCard";

const meta: Meta<typeof EvidenceCard> = {
  title: "EvidenceCard",
  component: EvidenceCard,
};
export default meta;

type Story = StoryObj<typeof EvidenceCard>;

export const TowardYes: Story = {
  args: {
    title: "Supplier hints foldable trial production has begun — The Information",
    url: "https://www.theinformation.com/briefings/apple-foldable-trial-production",
    deltaPp: 3.8,
    from: 0.17,
    to: 0.21,
    verified: true,
  },
};

export const TowardNo: Story = {
  args: {
    title: "Apple's foldable iPhone launch may slip to early 2027 — DigiTimes",
    url: "https://www.digitimes.com/news/apple-foldable-iphone-launch-2027.html",
    deltaPp: -13.6,
    from: 0.6,
    to: 0.46,
    verified: true,
  },
};

export const Reflection: Story = {
  args: {
    kind: "reflection",
    title: "↻ reflection on: iPhone Fold is 'on track' to launch this September",
    url: "https://www.macobserver.com/news/iphone-fold-delay-gurman",
    deltaPp: -3.4,
    from: 0.36,
    to: 0.32,
    verified: true,
  },
};

export const Unverified: Story = {
  args: {
    title: "Anonymous leaker claims October foldable reveal",
    url: "https://example.com/rumor",
    deltaPp: 2.1,
    from: 0.21,
    to: 0.23,
    verified: false,
  },
};

export const FadedStreamTail: Story = {
  args: {
    title: "Leaked 2026 iPhone lineup shows no foldable model — MacRumors",
    url: "https://www.macrumors.com/2026/06/apple-2026-iphone-lineup-no-foldable/",
    deltaPp: -7.1,
    from: 0.21,
    to: 0.14,
    verified: true,
    faded: true,
  },
};
