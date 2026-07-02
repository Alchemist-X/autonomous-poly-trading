import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProbabilityHero } from "../components/ProbabilityHero";

const meta: Meta<typeof ProbabilityHero> = {
  title: "ProbabilityHero",
  component: ProbabilityHero,
};
export default meta;

type Story = StoryObj<typeof ProbabilityHero>;

export const WithDelta: Story = {
  args: {
    prob: 0.333,
    deltaPp: -8.2,
  },
};

export const BaseRate: Story = {
  args: {
    prob: 0.15,
    baseRate: true,
  },
};

export const Final: Story = {
  args: {
    prob: 0.575,
    deltaPp: 4.0,
  },
};
