import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../lib/cn";

type HeroProps = {
  // Title accepts ReactNode so callers can highlight a word via <span className="accent">.
  title: ReactNode;
  subtitle?: ReactNode;
  // CTA buttons go here, rendered inside .hero-cta wrapper.
  actions?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Hero({ title, subtitle, actions, className, style }: HeroProps) {
  return (
    <section className={cn("hero", className)} style={style}>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {actions ? <div className="hero-cta">{actions}</div> : null}
    </section>
  );
}
