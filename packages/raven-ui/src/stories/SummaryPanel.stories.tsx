import type { Meta, StoryObj } from "@storybook/react-vite";
import { SummaryPanel } from "../components/SummaryPanel";

const meta: Meta<typeof SummaryPanel> = {
  title: "SummaryPanel",
  component: SummaryPanel,
};
export default meta;

type Story = StoryObj<typeof SummaryPanel>;

export const WithKeyFactors: Story = {
  args: {
    verdict:
      "Tesla almost certainly misses 500,000 Q2 deliveries. The two-week Fremont retooling for the refreshed Model Y cuts into peak production weeks, and China registrations are tracking well below the run-rate the target requires. A late-quarter discount push could close some of the gap, but not all of it.",
    keyFactorsYes: [
      "Refreshed Model Y demand is strong where it has launched, with wait times stretching into Q3.",
      "Aggressive end-of-quarter financing offers in the US and Europe historically pull deliveries forward.",
    ],
    keyFactorsNo: [
      "Fremont line idled ~2 weeks for the Model Y retool, removing peak-output weeks from the quarter.",
      "China weekly insurance-registration data is ~12% below the pace implied by a 500k quarter.",
      "Shanghai export allocation shifted toward Europe, lengthening in-transit inventory not counted as delivered.",
    ],
    uncertainties:
      "The exact split between produced-but-undelivered in-transit units and true demand softness is unclear, and Tesla has historically reclassified borderline deliveries on the final days of the quarter.",
  },
};

export const FallbackOnly: Story = {
  args: {
    fallbackNote: true,
    verdict:
      "On balance the Fed holds rates steady at the June meeting. Core PCE is cooling but still above target, and recent FOMC commentary has leaned toward waiting for more confirming data before any cut.",
  },
};

export const BitcoinNoFactors: Story = {
  args: {
    verdict:
      "Bitcoin closing the year above $150,000 is a coin-flip leaning slightly no. Spot-ETF inflows remain a powerful structural bid, but the move would require the rally to extend through a historically choppy Q4 without a macro shock.",
    uncertainties:
      "Whether ETF inflows persist at the current pace through year-end, and how a stronger-than-expected dollar would weigh on risk assets, are the dominant unknowns.",
  },
};
