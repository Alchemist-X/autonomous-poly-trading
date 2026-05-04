import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../lib/cn";

type PanelProps = {
  // Optional <h2> heading rendered inside the panel.
  title?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export function Panel({ title, className, style, children }: PanelProps) {
  return (
    <div className={cn("panel", className)} style={style}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </div>
  );
}
