import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type SectionProps = {
  title?: string;
  lead?: string;
  className?: string;
  children: ReactNode;
};

export function Section({ title, lead, className, children }: SectionProps) {
  return (
    <section className={cn("section", className)}>
      {title ? <h2>{title}</h2> : null}
      {lead ? <p className="section-lead">{lead}</p> : null}
      {children}
    </section>
  );
}
