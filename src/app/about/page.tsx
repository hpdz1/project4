import Link from "next/link";
import { Brand } from "@/components/site/Brand";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "About",
  description:
    "Why Package Radar exists, why no website can look up packages by address, and how we bring the delivery alerts of carriers and postal services around the world into one honest dashboard.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <Container size="narrow" className="py-10 sm:py-14">
      <PageHeader
        eyebrow="About"
        title="One honest answer to “is anything on the way?”"
        description={
          <>
            <Brand /> is a small, independent project that puts the delivery
            alerts carriers and postal services already send you into one
            place, wherever you live.
          </>
        }
      />

      <div className="article">
        <h2 id="why">Why we built it</h2>
        <p>
          Packages reach most homes through several carriers. A single week can
          bring a parcel from your national postal service, a box from an
          international courier such as UPS, DHL or FedEx, and a delivery from
          a local parcel company, each announced in a different app, email or
          text, often for things someone else ordered for you. Finding out
          whether anything is on the way means checking three or four places.
        </p>
        <p>
          We wanted one page that answers a simple question: is anything on
          the way to me right now? Not just the orders in one shopping
          account, but every package your carriers and postal services tell
          you about, in any country.
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
          Carriers and postal services do share this information with the
          right person, through free alert programs you sign up for yourself.
          How they decide that a parcel is yours differs around the world:
        </p>
        <ul>
          <li>
            <strong>Some verify your address.</strong> Programs such as USPS
            Informed Delivery, UPS My Choice and Swiss Post&apos;s &ldquo;My
            consignments&rdquo; check that you really live at your address
            (often with a code sent there by post) and then alert you about
            parcels heading to it, including ones you didn&apos;t order
            yourself.
          </li>
          <li>
            <strong>Others match your email address or phone number.</strong>{" "}
            Many postal services and parcel companies, for example in the
            Nordic countries, Ireland or Poland, link a parcel to you when the
            sender gave them the email address or phone number you registered.
          </li>
        </ul>
        <p>
          Either way, each program only covers its own carrier, and the alerts
          land in different places. That is the gap <Brand /> fills.
        </p>

        <h2 id="how">How <Brand /> works</h2>
        <ol>
          <li>
            <strong>Check your coverage.</strong> You type your address; your
            browser works out your country, postcode and region, and we show
            which carrier and postal programs cover your home. Your street
            address never leaves your browser.
          </li>
          <li>
            <strong>Turn on the carriers&apos; own alerts, once.</strong> You
            sign up for each free program directly on the carrier&apos;s or
            postal service&apos;s website or app, with email alerts switched
            on.
          </li>
          <li>
            <strong>Forward the alerts.</strong> You add an email filter that
            forwards those carriers&apos; emails to a personal{" "}
            <Brand /> address. We read the shipment details from each email
            and show everything on one dashboard.
          </li>
        </ol>
        <p>
          Because the information comes from the carriers&apos; own alerts,{" "}
          <Brand /> is only as complete as those alerts are. Some packages,
          such as ones delivered by a retailer&apos;s own drivers, may never
          generate a carrier email, and in some countries carriers send alerts
          only by text message or in their app, which we can&apos;t receive.
          Our <Link href="/guides">guides</Link> explain the gaps and how to
          cover them.
        </p>

        <h2 id="worldwide">Made for every country, written in English</h2>
        <p>
          <Brand /> works with carriers and postal services around the world,
          and understands their emails in several languages. The site itself is
          written in plain English so that your browser&apos;s built-in
          translation works well; dates are written out (such as &ldquo;Tue,
          Oct 13&rdquo;) so they can&apos;t be misread. Coverage differs by
          country and keeps growing.
        </p>

        <h2 id="never">What we never do</h2>
        <ul>
          <li>We never ask for your carrier passwords or log in to carrier websites for you.</li>
          <li>We never scrape carrier websites.</li>
          <li>We never ask for tracking numbers — the carriers&apos; emails bring them.</li>
          <li>We never claim to look up packages by address.</li>
          <li>
            We never sell your data, we never keep the full text of your
            emails, and we never store what your parcels contain.
          </li>
        </ul>
        <p>
          <Brand /> is free and supported by ads on some pages. It is
          independent and not affiliated with any postal service, carrier or
          retailer. Read our <Link href="/privacy">privacy policy</Link> for
          exactly what we store and for how long, or{" "}
          <Link href="/contact">get in touch</Link>.
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
