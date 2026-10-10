import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { Container } from "@/components/ui/Container";
import { LogoMark } from "./Logo";
import { NavLink } from "./NavLink";

const LINK =
  "inline-flex min-h-10 items-center rounded-lg px-3 text-[0.9375rem] font-medium text-muted transition-colors hover:bg-subtle hover:text-text";
const LINK_ACTIVE = "text-text bg-subtle";
const CTA =
  "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3.5 text-[0.9375rem] font-semibold transition-colors bg-accent text-accent-contrast hover:bg-accent-hover";

/** Site header: wordmark plus primary navigation. Wraps to two rows on phones. */
export function Header() {
  return (
    <header className="border-b border-border bg-surface">
      <Container
        size="wide"
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3"
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg py-1 text-lg font-bold tracking-tight text-text"
        >
          <LogoMark />
          {/* The brand name must survive browser translation. */}
          <span translate="no">{SITE_NAME}</span>
        </Link>
        <nav aria-label="Main" className="-mx-3 w-[calc(100%+1.5rem)] sm:mx-0 sm:w-auto">
          <ul className="flex flex-wrap items-center gap-1 sm:gap-2">
            <li>
              <NavLink href="/#how-it-works" className={LINK}>
                How it works
              </NavLink>
            </li>
            <li>
              <NavLink href="/guides" className={LINK} activeClassName={LINK_ACTIVE}>
                Guides
              </NavLink>
            </li>
            <li className="ml-auto sm:ml-2">
              <NavLink href="/dashboard" className={CTA}>
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                  <path d="M10 2a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6V2Z" opacity="0.6" />
                  <path d="M10 6a4 4 0 1 0 4 4h-2a2 2 0 1 1-2-2V6Z" />
                  <path d="M10 2v8l5.66-5.66A7.97 7.97 0 0 0 10 2Z" />
                </svg>
                My radar
              </NavLink>
            </li>
          </ul>
        </nav>
      </Container>
    </header>
  );
}
