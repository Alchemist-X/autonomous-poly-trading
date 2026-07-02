import type { Meta, StoryObj } from "@storybook/react-vite";
import { QuestionInput } from "../components/QuestionInput";

const meta: Meta<typeof QuestionInput> = {
  title: "QuestionInput",
  component: QuestionInput,
};
export default meta;

type Story = StoryObj<typeof QuestionInput>;

const EXAMPLES = [
  "Will Apple ship a foldable iPhone in 2026?",
  "Will Bitcoin trade above $150k before 2027?",
  "Will the Fed cut rates at the next meeting?",
  "Will GPT-5 launch before 2026?",
];

export const Empty: Story = {
  args: {
    placeholder: "Will Apple ship a foldable iPhone in 2026?",
    examples: EXAMPLES,
  },
};

export const Prefilled: Story = {
  args: {
    defaultValue: "Will Bitcoin trade above $150k before 2027?",
    examples: EXAMPLES,
  },
};
