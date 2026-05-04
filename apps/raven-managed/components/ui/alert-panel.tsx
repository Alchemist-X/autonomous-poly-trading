import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type AlertVariant = "warning" | "info";

type AlertPanelProps = {
  variant?: AlertVariant;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

// Warning is the only style currently expressed in globals.css (.disclaimer).
// TODO: introduce a dedicated .disclaimer-info modifier once info copy lands.
export function AlertPanel({
  variant = "warning",
  className,
  style,
  children
}: AlertPanelProps) {
  void variant;
  return (
    <div className={cn("disclaimer", className)} style={style}>
      {children}
    </div>
  );
}
