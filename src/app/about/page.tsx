import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { SITE_NAME, pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "About",
  description:
    "Why Package Radar exists, why no website can look up packages by address, and how we bring your carriers' own delivery alerts into one honest dashboard.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <Container size="narrow" className="py-10 sm:py-14">
      <PageHeader
        eyebrow="About"
        title="One honest answer to “is anything on the way?”"
        description={`${SITE_NAME} is a small, independent project that puts the delivery alerts carriers already send you into one place.`}
      />

      <div className="article">
        <h2 id="why">Why we built it</h2>
        <p>
          Packages reach most homes through several carriers. A single week can
          bring a USPS parcel, a UPS box and a FedEx delivery, each announced
          in a different app, email or text, often for things someone else
          ordered for you. Finding out whether anything is on the way means
          checking three or four places.
        </p>
        <p>
          We wanted one page that answers a simple question: is anything on
          the way to my home right now? Not just the orders in your own
          shopping account, but every package the carriers know is headed to
          your address.
        </p>

        <h2 id="no-address-lookup">Why no website can look up packages by address</h2>
        <p>
          You may have seen sites that promise to &ldquo;track any package by
          address&rdquo;. They can&apos;t. Carriers don&apos;t publish which
          packages are going to an address, and for good reason: if anyone
          could look that up, strangers could watch a home&apos;s deliveries,
          which helps porch thieves and stalkers. Messages that ask you to
          &ldquo;confirm your address to see your package&rdquo; are a common
          phishing scam.
        </p>
        <p>
          Carriers do show this information to one person: a resident who has
          proved they live there. USPS Informed Delivery, UPS My Choice and
          FedEx Delivery Manager are free programs that verify you at your
          address and then email you about packages headed your way, including
          ones you didn&apos;t order. The catch is that each one only covers
          its own carrier.
        </p>

        <h2 id="how">How {SITE_NAME} works</h2>
        <ol>
          <li>
            <strong>Check your coverage.</strong> You type your address; your
            browser works out your ZIP or postcode and region, and we show which
            carrier programs cover your home. Your street address never leaves
            your browser.
          </li>
          <li>
            <strong>Turn on the carriers&apos; own alerts, once.</strong> You
            sign up for each free program directly on the carrier&apos;s
            website, with email alerts switched on.
          </li>
          <li>
            <strong>Forward the alerts.</strong> You add an email filter that
            forwards those carriers&apos; emails to a personal{" "}
            {SITE_NAME} address. We read the shipment details from each email
            and show everything on one dashboard.
          </li>
        </ol>
        <p>
          Because the information comes from the carriers&apos; own alerts,
          {" "}{SITE_NAME} is only as complete as those alerts are. Some
          packages, such as ones delivered by a retailer&apos;s own drivers,
          may never generate a carrier email. Our{" "}
          <Link href="/guides">guides</Link> explain the gaps and how to cover
          them.
        </p>

        <h2 id="never">What we never do</h2>
        <ul>
          <li>We never ask for your carrier passwords or log in to carrier websites for you.</li>
          <li>We never scrape carrier websites.</li>
          <li>We never ask for tracking numbers — the carriers&apos; emails bring them.</li>
          <li>We never claim to look up packages for an address you haven&apos;t verified.</li>
          <li>We never sell your data, and we don&apos;t keep the full text of your emails.</li>
        </ul>
        <p>
          {SITE_NAME} is free and supported by ads on some pages. It is
          independent and not affiliated with USPS, UPS, FedEx, Amazon, DHL or
          any other carrier. Read our <Link href="/privacy">privacy policy</Link>{" "}
          for exactly what we store, or <Link href="/contact">get in touch</Link>.
        </p>
      </div>

      <Card tone="accent" padding="lg" className="mt-12 space-y-3">
        <h2 className="text-lg font-semibold">Ready to try it?</h2>
        <p className="text-[0.9375rem] leading-relaxed text-muted">
          Setup walks you through each carrier program and the forwarding
          filter for your email provider, step by step.
        </p>
        <Button href="/setup">Set up your Package Radar</Button>
      </Card>
    </Container>
  );
}
