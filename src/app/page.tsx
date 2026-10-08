import Link from "next/link";
import type { Metadata, Route } from "next";
import type { ReactNode } from "react";
import { GUIDES } from "@/content/guides";
import { AdSlot } from "@/components/ads/AdSlot";
import { JsonLd } from "@/components/site/JsonLd";
import { formatIsoDate } from "@/components/site/guides";
import { AddressCoverage } from "@/components/radar/AddressCoverage";
import { ExampleDashboard } from "@/components/radar/ExampleDashboard";
import { CheckIcon, MailIcon, RadarIcon, TruckIcon } from "@/components/radar/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { AD_SLOTS, SITE_NAME, absoluteUrl, pageMetadata } from "@/lib/site";

const TITLE = "Package Radar: every carrier's delivery alerts in one place";
const DESCRIPTION =
  "Connect the free delivery alerts USPS, UPS and FedEx already offer for your home and see everything on the way in one place. No tracking numbers or passwords.";

export const metadata: Metadata = {
  ...pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/" }),
  title: { absolute: TITLE },
};

const STEPS = [
  {
    icon: TruckIcon,
    title: "Turn on your carriers' free alerts",
    body: "Sign up for USPS Informed Delivery, UPS My Choice and FedEx Delivery Manager on each carrier's own website and switch on their email alerts. Each carrier checks that you live at the address, usually online in a few minutes; some mail you a code, which can take a few days to a couple of weeks.",
  },
  {
    icon: MailIcon,
    title: "Forward only those alerts",
    body: "Add one filter or rule in Gmail, Outlook, Yahoo or iCloud that forwards the carriers' emails to your private Package Radar address. The rest of your inbox stays where it is. Gmail asks you to confirm the address once, and the setup page shows you Gmail's confirmation as soon as it arrives.",
  },
  {
    icon: RadarIcon,
    title: "Get one answer",
    body: "We read each alert as it arrives (carrier, tracking number, sender, status and expected date), keep those details and discard the email. Your dashboard answers one question: is anything on the way to my home? It also tells you when a carrier has gone quiet, so a broken filter doesn't go unnoticed.",
  },
];

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Is it free?",
    a: (
      <>
        Yes. Package Radar is free and supported by ads. The carrier programs are free too: UPS My Choice has an
        optional paid Premium tier you don&apos;t need for alerts, and FedEx charges for some delivery changes, not for
        alerts.
      </>
    ),
  },
  {
    q: "What do you store?",
    a: (
      <>
        Your country, ZIP or postcode, state and time zone; the shipment details we read from forwarded carrier emails
        (carrier, tracking number, sender, status, expected date); and a short log of which kinds of email arrived. We
        don&apos;t keep the emails themselves, and your street address never leaves your browser. The{" "}
        <Link href="/privacy" className="font-medium text-accent underline underline-offset-4">
          privacy policy
        </Link>{" "}
        has the details.
      </>
    ),
  },
  {
    q: "Do you need my passwords?",
    a: (
      <>
        No. You sign up with each carrier on the carrier&apos;s own website and set up forwarding in your own email
        settings. We never ask for your carrier or email passwords, never sign in to carrier sites for you, and never ask
        for tracking numbers or card details. You open your radar with a private sign-in link instead.
      </>
    ),
  },
  {
    q: "Which carriers does it cover?",
    a: (
      <>
        In the US, USPS Informed Delivery, UPS My Choice and FedEx Delivery Manager cover packages addressed to your
        home, including ones you didn&apos;t order. Amazon&apos;s shipping emails cover your own Amazon orders, and DHL
        Express emails cover individual shipments. OnTrac only sends text messages, so its packages appear only when an
        email mentions them.
      </>
    ),
  },
  {
    q: "What about Amazon?",
    a: (
      <>
        Amazon delivers many packages with its own drivers, and no carrier program covers those. If you forward
        Amazon&apos;s shipping emails, your own orders appear. Packages someone else orders for you on Amazon (a gift,
        or a housemate&apos;s order) won&apos;t, because Amazon only emails the account that placed the order. Amazon
        parcels handed to USPS, UPS or FedEx do show up in those carriers&apos; alerts.
      </>
    ),
  },
  {
    q: "Will it catch every package?",
    a: (
      <>
        No, and nothing can. We only see what your carriers email you. A package usually appears once the carrier has
        its label data or first scan, USPS says its Daily Digest can be incomplete, and regional couriers aren&apos;t
        covered. Your dashboard shows when each carrier last emailed, so you can tell a quiet week from a broken filter.
      </>
    ),
  },
  {
    q: "What if I live outside the US?",
    a: (
      <>
        Pick your country in the address box to see which programs cover it. We have details for Canada, the UK,
        Australia, Germany and the Netherlands. Outside the US we pick up tracking numbers from carrier emails but may
        not show delivery dates or senders, and FedEx Delivery Manager outside the US and Canada only covers shipments
        where the sender has switched it on.
      </>
    ),
  },
  {
    q: "How do I delete my data?",
    a: (
      <>
        Open your dashboard, go to Settings and choose Delete my data. Everything is deleted straight away. Then remove
        the forwarding filter from your email so carrier alerts stop being sent to us.
      </>
    ),
  },
];

const SECTION_HEADING = "text-2xl font-bold tracking-tight text-balance sm:text-3xl";
const TEXT_LINK = "font-medium text-accent underline underline-offset-4 hover:no-underline";

export default function HomePage() {
  const guides = GUIDES.slice(0, 4).map((g) => g.meta);
  const scamGuide = GUIDES.find((g) => g.meta.slug === "fake-delivery-text-scams")?.meta;
  const noNumberGuide = GUIDES.find((g) => g.meta.slug === "track-a-package-without-a-tracking-number")?.meta;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: absoluteUrl("/"),
          description: DESCRIPTION,
        }}
      />

      <section aria-labelledby="hero-heading" className="border-b border-border bg-surface">
        <Container size="wide" className="py-12 sm:py-16">
          <div className="mx-auto max-w-3xl space-y-5 text-center">
            <p className="text-sm font-semibold tracking-wide text-accent uppercase">
              Free · Works with USPS, UPS and FedEx
            </p>
            <h1 id="hero-heading" className="text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl">
              Know what&apos;s on the way to your home — from every carrier.
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-pretty text-muted">
              Connect the free delivery alerts USPS, UPS and FedEx already offer for your address, and Package Radar puts
              them in one place.
            </p>
            <ul className="flex flex-col items-center gap-2 text-[0.9375rem] sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6">
              {["No tracking numbers to type", "No carrier passwords", "Your street address stays in your browser"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckIcon className="size-4 text-success" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </div>
          <div className="mt-10">
            <AddressCoverage />
          </div>
        </Container>
      </section>

      <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-4 py-14 sm:py-20">
        <Container>
          <div className="max-w-2xl space-y-3">
            <h2 id="how-heading" className={SECTION_HEADING}>
              How it works
            </h2>
            <p className="text-lg leading-relaxed text-muted">
              A one-time setup of about 10 minutes, then nothing to do. You stay in control at every step: the carriers
              verify you, your email does the forwarding, and you can switch it off any time.
            </p>
          </div>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Card as="li" key={step.title} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <step.icon />
                  </span>
                  <span className="text-sm font-semibold text-muted">Step {i + 1}</span>
                </div>
                <h3 className="text-lg leading-snug font-semibold">{step.title}</h3>
                <p className="text-[0.9375rem] leading-relaxed text-muted">{step.body}</p>
              </Card>
            ))}
          </ol>
        </Container>
      </section>

      <section aria-labelledby="why-heading" className="border-y border-border bg-surface py-14 sm:py-20">
        <Container size="narrow" className="space-y-5">
          <h2 id="why-heading" className={SECTION_HEADING}>
            Why can&apos;t a website just look up my address?
          </h2>
          <div className="space-y-4 text-[1.0625rem] leading-relaxed">
            <p>
              Because the carriers don&apos;t allow it, and you wouldn&apos;t want them to. If any website could list the
              packages headed to an address, anyone could watch your deliveries: porch thieves, stalkers and scammers
              included. Carriers show that list to one person only, a resident who has proved they live there, with an
              identity check or a code mailed to the home.
            </p>
            <p>
              So be wary of any site that promises to find packages by address. It can&apos;t, and a text or email
              asking you to &ldquo;confirm your address to see your package&rdquo; is a common phishing trick
              {scamGuide ? (
                <>
                  {" "}
                  (our guide to{" "}
                  <Link href={`/guides/${scamGuide.slug}` as Route} className={TEXT_LINK}>
                    fake delivery texts
                  </Link>{" "}
                  shows how to spot one)
                </>
              ) : null}
              .
            </p>
            <p>
              Package Radar works the honest way round. You prove to each carrier that you live there, the carriers
              email you about packages for your address, and you forward those emails to us. We never look anything up
              and never ask where you live beyond your ZIP code.
            </p>
            {noNumberGuide ? (
              <p>
                Waiting on something specific and don&apos;t have a tracking number? Read{" "}
                <Link href={`/guides/${noNumberGuide.slug}` as Route} className={TEXT_LINK}>
                  how to track a package without a tracking number
                </Link>{" "}
                for what the carriers can and can&apos;t do for you.
              </p>
            ) : null}
          </div>
        </Container>
      </section>

      <Container>
        <AdSlot slot={AD_SLOTS.landing} />
      </Container>

      <section aria-labelledby="example-heading" className="py-14 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
          <div className="space-y-4">
            <h2 id="example-heading" className={SECTION_HEADING}>
              What you&apos;ll see
            </h2>
            <p className="text-lg leading-relaxed text-muted">
              One page with every carrier side by side, sorted by what matters today.
            </p>
            <ul className="space-y-3 text-[0.9375rem] leading-relaxed">
              <li>
                <strong>Arriving today</strong> and <strong>On the way</strong>, with the delivery window when the carrier
                gives one.
              </li>
              <li>
                <strong>Needs attention</strong> for exceptions, packages waiting at a pickup point, and anything that
                was due but hasn&apos;t arrived.
              </li>
              <li>
                <strong>Delivered recently</strong> for the last few days, so you know whether to check the porch.
              </li>
              <li>
                Packages you didn&apos;t order show up too: Informed Delivery, UPS My Choice and FedEx Delivery Manager
                report everything addressed to your home.
              </li>
            </ul>
          </div>
          <ExampleDashboard />
        </Container>
      </section>

      <section aria-labelledby="faq-heading" className="border-y border-border bg-surface py-14 sm:py-20">
        <Container size="narrow" className="space-y-8">
          <h2 id="faq-heading" className={SECTION_HEADING}>
            Questions people ask
          </h2>
          <div className="divide-y divide-border rounded-2xl border border-border">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5 py-1">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                  <h3 className="text-base font-semibold sm:text-lg">{item.q}</h3>
                  <span aria-hidden="true" className="text-xl text-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="pb-4 text-[0.9375rem] leading-relaxed text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <section aria-labelledby="guides-heading" className="py-14 sm:py-20">
        <Container className="space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="guides-heading" className={SECTION_HEADING}>
              Latest guides
            </h2>
            <Link href="/guides" className={TEXT_LINK}>
              All guides
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {guides.map((meta) => (
              <Card as="li" key={meta.slug} className="relative flex flex-col gap-2 transition-colors hover:border-accent/50">
                <p className="text-sm font-semibold text-accent">{meta.category}</p>
                <h3 className="text-lg leading-snug font-semibold">
                  <Link
                    href={`/guides/${meta.slug}` as Route}
                    className="after:absolute after:inset-0 after:rounded-2xl hover:text-accent"
                  >
                    {meta.title}
                  </Link>
                </h3>
                <p className="text-[0.9375rem] leading-relaxed text-muted">{meta.description}</p>
                <p className="mt-auto pt-1 text-sm text-muted">
                  {meta.readingMinutes} min read · Updated <time dateTime={meta.updated}>{formatIsoDate(meta.updated)}</time>
                </p>
              </Card>
            ))}
          </ul>

          <Card tone="accent" padding="lg" className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Ready to see what&apos;s coming?</h2>
              <p className="text-[0.9375rem] leading-relaxed text-muted">
                Set up takes about 10 minutes. You&apos;ll need access to your email settings on a computer.
              </p>
            </div>
            <Button href="/setup" size="lg" className="shrink-0">
              Set up my radar
            </Button>
          </Card>
        </Container>
      </section>
    </>
  );
}
