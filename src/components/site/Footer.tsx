import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { Container } from "@/components/ui/Container";
import { LogoMark } from "./Logo";

const FOOTER_LINKS = [
  { href: "/guides", label: "Guides" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
] as const;

export const CARRIER_DISCLAIMER =
  "Package Radar is independent and not affiliated with USPS, UPS, FedEx, Amazon, DHL or any carrier. Carrier names are trademarks of their owners.";

/** Site footer: secondary links, the carrier disclaimer and copyright. */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <Container size="wide" className="space-y-6 py-10 text-sm text-muted">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm space-y-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg font-semibold text-text"
            >
              <LogoMark className="size-6" />
              {SITE_NAME}
            </Link>
            <p>{SITE_TAGLINE} — using the alerts your carriers already send you.</p>
          </div>
          <nav aria-label="Footer">
            <ul className="-mx-2.5 flex flex-wrap gap-x-1 gap-y-1">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-10 items-center rounded-lg px-2.5 font-medium text-muted hover:bg-subtle hover:text-text"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="max-w-3xl leading-relaxed">{CARRIER_DISCLAIMER}</p>
        <p>
          © {year} {SITE_NAME}
        </p>
      </Container>
    </footer>
  );
}
