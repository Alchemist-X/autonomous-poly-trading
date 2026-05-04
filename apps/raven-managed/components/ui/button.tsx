import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

// Visual variant maps to existing globals.css classes.
// Default is "secondary" (the bare .btn). Source of truth for styles is
// app/globals.css — this component only picks the right class string.
export type ButtonVariant = "primary" | "secondary" | "ghost";

const variantClass = (variant: ButtonVariant): string | undefined => {
  if (variant === "primary") return "btn-primary";
  if (variant === "ghost") return "btn-ghost";
  return undefined;
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  variant = "secondary",
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cn("btn", variantClass(variant), className)} {...rest}>
      {children}
    </button>
  );
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ButtonVariant;
  children?: ReactNode;
};

// LinkButton is for places that render an anchor styled as a button.
// External links (with target/rel or absolute URLs) use a plain <a>;
// internal routes go through next/link <Link>.
export function LinkButton({
  href,
  variant = "secondary",
  className,
  children,
  target,
  rel,
  ...rest
}: LinkButtonProps) {
  const classes = cn("btn", variantClass(variant), className);
  const isExternal = /^https?:\/\//.test(href) || target === "_blank";
  if (isExternal) {
    return (
      <a href={href} target={target} rel={rel} className={classes} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} {...rest}>
      {children}
    </Link>
  );
}
