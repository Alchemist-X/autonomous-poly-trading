import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type BadgeVariant = "pending" | "active" | "disabled";

const variantClass = (variant: BadgeVariant): string => {
  if (variant === "active") return "badge-active";
  if (variant === "disabled") return "badge-disabled";
  return "badge-pending";
};

type BadgeProps = {
  variant: BadgeVariant;
  className?: string;
  children: ReactNode;
};

export function Badge({ variant, className, children }: BadgeProps) {
  return <span className={cn("badge", variantClass(variant), className)}>{children}</span>;
}
