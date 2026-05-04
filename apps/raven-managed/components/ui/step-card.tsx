import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type StepCardProps = {
  title: string;
  className?: string;
  children: ReactNode;
};

// StepCard relies on the parent <StepsContainer> resetting the CSS counter.
// The .step::before pseudo-element auto-increments and renders the number,
// so steps must live inside a .steps container to be numbered correctly.
export function StepCard({ title, className, children }: StepCardProps) {
  return (
    <div className={cn("step", className)}>
      <h4>{title}</h4>
      <p>{children}</p>
    </div>
  );
}

type StepsContainerProps = {
  className?: string;
  children: ReactNode;
};

export function StepsContainer({ className, children }: StepsContainerProps) {
  return <div className={cn("steps", className)}>{children}</div>;
}
