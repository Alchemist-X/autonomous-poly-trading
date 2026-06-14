import type { Metadata } from "next";
import { ResearchConsole } from "../../components/research/research-console";

export const metadata: Metadata = {
  title: "Forecasting Engine — Predict Raven",
  description:
    "Ask any verifiable future event in natural language and watch an AI superforecaster reason in the open: layered evidence, a conditional-probability model, Bayesian updates, and a calibrated probability with an 80% confidence interval."
};

// Public Forecasting Engine surface. The interactive console owns the full
// localized shell (header + language toggle + streaming + compliance footer);
// this route only supplies metadata and the dynamic flag.
export const dynamic = "force-dynamic";

export default function ResearchPage() {
  return <ResearchConsole />;
}
