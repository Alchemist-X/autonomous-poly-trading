import type { Meta, StoryObj } from "@storybook/react-vite";
import { RavenHeader } from "../components/RavenHeader";

const meta: Meta<typeof RavenHeader> = {
  title: "RavenHeader",
  component: RavenHeader,
};
export default meta;

type Story = StoryObj<typeof RavenHeader>;

export const Landing: Story = {
  args: { theme: "dark", showNewQuestion: false },
};

export const InSession: Story = {
  args: { theme: "dark", showNewQuestion: true },
};
