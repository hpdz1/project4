import Link from "next/link";
import type { Route } from "next";

export interface Crumb {
  label: string;
  /** Omit for the current page (the last crumb). */
  href?: string;
}

/** Breadcrumb trail; the last item is marked aria-current="page". */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-2">
              {item.href && !last ? (
                <Link
                  href={item.href as Route}
                  className="rounded underline-offset-4 hover:text-text hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="text-text">
                  {item.label}
                </span>
              )}
              {last ? null : (
                <span aria-hidden="true" className="text-border-strong">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
