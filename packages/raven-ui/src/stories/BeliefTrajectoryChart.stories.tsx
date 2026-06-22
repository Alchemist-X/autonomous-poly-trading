import type { Meta, StoryObj } from "@storybook/react-vite";
import { BeliefTrajectoryChart } from "../components/BeliefTrajectoryChart";

const meta: Meta<typeof BeliefTrajectoryChart> = {
  title: "BeliefTrajectoryChart",
  component: BeliefTrajectoryChart,
};
export default meta;

type Story = StoryObj<typeof BeliefTrajectoryChart>;

// "Will Apple ship a foldable iPhone in 2026?" — rises on early supply-chain
// leaks, then falls as delay reports land, converging near 11%.
export const FoldableIPhone: Story = {
  args: {
    prior: 0.15,
    points: [
      { prob: 0.30, round: 1 },
      { prob: 0.42, round: 1 },
      { prob: 0.31, round: 1 },
      { prob: 0.17, round: 2 },
      { prob: 0.21, round: 2 },
      { prob: 0.14, round: 3 },
      { prob: 0.12, round: 3 },
      { prob: 0.11, round: 4 },
    ],
  },
};

// A near-certain outcome — the y-axis auto-scales toward 100%.
export const HighProbability: Story = {
  args: {
    prior: 0.5,
    points: [
      { prob: 0.70, round: 1 },
      { prob: 0.85, round: 1 },
      { prob: 0.92, round: 2 },
      { prob: 0.99, round: 2 },
    ],
  },
};
