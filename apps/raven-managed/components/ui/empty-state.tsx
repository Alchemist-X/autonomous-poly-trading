import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type EmptyStateProps = {
  // Optional decorative element — typically a Lucide icon at 64px.
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function EmptyState({ icon, className, children }: EmptyStateProps) {
  return (
    <div className={cn("empty", className)}>
      {icon ? <div style={{ marginBottom: 8 }}>{icon}</div> : null}
      {children}
    </div>
  );
}
