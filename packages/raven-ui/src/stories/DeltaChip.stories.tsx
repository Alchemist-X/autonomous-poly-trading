import type { Meta, StoryObj } from "@storybook/react-vite";
import { DeltaChip } from "../components/DeltaChip";

const meta: Meta<typeof DeltaChip> = {
  title: "DeltaChip",
  component: DeltaChip,
};
export default meta;

type Story = StoryObj<typeof DeltaChip>;

export const Positive: Story = {
  args: {
    deltaPp: 5.2,
  },
};

export const Negative: Story = {
  args: {
    deltaPp: -13.6,
  },
};

export const SmallSize: Story = {
  args: {
    deltaPp: 3.8,
    size: "sm",
  },
};
