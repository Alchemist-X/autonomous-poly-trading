import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type FeatureCardProps = {
  // Icon expects a Lucide icon node — rendered inside the .icon badge.
  icon: ReactNode;
  title: string;
  className?: string;
  children: ReactNode;
};

export function FeatureCard({ icon, title, className, children }: FeatureCardProps) {
  return (
    <div className={cn("feature-card", className)}>
      <div className="icon">{icon}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

type FeatureGridProps = {
  className?: string;
  children: ReactNode;
};

export function FeatureGrid({ className, children }: FeatureGridProps) {
  return <div className={cn("feature-grid", className)}>{children}</div>;
}
