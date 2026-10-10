import type { ReactNode } from "react";

/**
 * A clearly marked "fill this in" note for the site operator, e.g. a missing
 * postal address on the privacy policy. Callers render it only when
 * `showOperatorPlaceholders` is true (development builds), so visitors to a
 * production site never see it.
 */
export function DevPlaceholder({ children }: { children: ReactNode }) {
  return (
    <span
      data-dev-placeholder=""
      className="rounded-md border border-dashed border-warning bg-warning-soft px-1.5 py-0.5 text-[0.9375em] font-medium text-warning"
    >
      [Placeholder, shown in development only: {children}]
    </span>
  );
}
