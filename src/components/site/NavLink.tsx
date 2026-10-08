"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { isCurrentPath } from "./nav";

/** Header navigation link that marks the current section with aria-current. */
export function NavLink({
  href,
  className,
  activeClassName,
  children,
}: {
  href: string;
  className?: string;
  activeClassName?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const current = isCurrentPath(pathname, href);
  return (
    <Link
      href={href as Route}
      aria-current={current ? "page" : undefined}
      className={cx(className, current && activeClassName)}
    >
      {children}
    </Link>
  );
}
