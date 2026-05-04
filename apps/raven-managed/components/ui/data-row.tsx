import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type DataRowProps = {
  label: string;
  // value can be a string, formatted ReactNode, or a <Badge>.
  value: ReactNode;
  className?: string;
};

export function DataRow({ label, value, className }: DataRowProps) {
  return (
    <div className={cn("row", className)}>
      <span className="row-label">{label}</span>
      {/* If value is already an element with its own class (e.g. Badge),
          render it as-is. Otherwise wrap in .row-value for mono styling. */}
      {isPrimitive(value) ? <span className="row-value">{value}</span> : value}
    </div>
  );
}

const isPrimitive = (value: ReactNode): boolean => {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  );
};
