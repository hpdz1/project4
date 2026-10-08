import type { ReactNode } from "react";
import { cx } from "./cx";

export interface PageHeaderProps {
  title: ReactNode;
  /** Small label above the title, e.g. a guide category. */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Rendered under the description: meta line, actions, etc. */
  children?: ReactNode;
  className?: string;
}

/** The page's <h1> with optional eyebrow, lead paragraph and extras. */
export function PageHeader({
  title,
  eyebrow,
  description,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cx("space-y-3 pb-6 sm:pb-8", className)}>
      {eyebrow ? (
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="max-w-[65ch] text-lg leading-relaxed text-muted text-pretty">
          {description}
        </p>
      ) : null}
      {children ? <div className="pt-1">{children}</div> : null}
    </header>
  );
}
