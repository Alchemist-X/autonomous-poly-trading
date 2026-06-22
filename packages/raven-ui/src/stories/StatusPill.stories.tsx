import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusPill } from "../components/StatusPill";

const meta: Meta<typeof StatusPill> = {
  title: "StatusPill",
  component: StatusPill,
};
export default meta;

type Story = StoryObj<typeof StatusPill>;

export const Researching: Story = {
  args: {
    label: "Researching · iteration 2",
    state: "running",
  },
};

export const Framing: Story = {
  args: {
    label: "Framing the question",
    state: "running",
  },
};

export const Converged: Story = {
  args: {
    label: "Belief converged",
    state: "done",
  },
};
