import type { Meta, StoryObj } from "@storybook/react-vite";
import { VerdictBadge } from "../components/VerdictBadge";

const meta: Meta<typeof VerdictBadge> = {
  title: "VerdictBadge",
  component: VerdictBadge,
};
export default meta;

type Story = StoryObj<typeof VerdictBadge>;

export const VeryUnlikely: Story = {
  args: {
    prob: 0.04,
    caption: "started 12% prior",
  },
};

export const TossUp: Story = {
  args: {
    prob: 0.5,
    caption: "started 45% prior",
  },
};

export const Likely: Story = {
  args: {
    prob: 0.82,
    caption: "started 60% prior",
  },
};

export const NoCaption: Story = {
  args: {
    prob: 0.31,
  },
};
