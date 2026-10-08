import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

// No ads on this screen: AdSense doesn't allow ads on error or dead-end pages.
export const metadata: Metadata = {
  title: "Page not found",
  description: "This page doesn't exist. Head back to the home page or browse our guides.",
};

export default function NotFound() {
  return (
    <Container size="narrow" className="py-16 text-center sm:py-24">
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        Nothing on the radar here
      </h1>
      <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-muted">
        We couldn&apos;t find that page. It may have moved, or the link may be
        mistyped.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button href="/">Go to the home page</Button>
        <Button href="/guides" variant="secondary">
          Browse the guides
        </Button>
      </div>
      <p className="mt-8 text-[0.9375rem] text-muted">
        Looking for your packages?{" "}
        <Link href="/dashboard" className="font-medium text-accent underline underline-offset-4">
          Open your radar
        </Link>{" "}
        · Something broken?{" "}
        <Link href="/contact" className="font-medium text-accent underline underline-offset-4">
          Tell us
        </Link>
      </p>
    </Container>
  );
}
